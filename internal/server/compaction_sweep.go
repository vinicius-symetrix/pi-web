package server

import (
	"context"
	"encoding/json"
	"bufio"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"pi-web/internal/rpc"
)

// Compaction sweeper: sessions whose pi worker is gone never auto-compact
// (compaction runs inside the worker), so long-idle sessions stay bloated.
// This sweep periodically compacts them out-of-band: for each idle session
// file that is large and untouched for a day, spawn a short-lived
// `pi --mode rpc`, switch to that session, and run compact. pi auto-compacts
// live workers itself; this only covers the idle tail.
const (
	compactionSweepMinAge    = 24 * time.Hour
	compactionSweepMaxPer    = 3        // sessions per pass; keep API spend bounded
	compactionSweepThreshold = 0.80     // compact when context is this full
	compactionFallbackBytes  = 3 << 20  // sessions with no model/usage data fall back to size
)

func (s *Server) runCompactionSweeper(stop <-chan struct{}, every time.Duration) {
	// Run soon after boot, then on the ticker.
	timer := time.NewTimer(time.Minute)
	defer timer.Stop()
	for {
		select {
		case <-stop:
			return
		case <-timer.C:
		}
		s.compactionSweepPass(context.Background())
		timer.Reset(every)
	}
}

// modelContextWindows reads ~/.pi/agent/models.json once per pass and maps
// "provider/modelId" -> contextWindow. pi stores contextWindow per model, so
// the sweep compacts each session against ITS model's real window instead of a
// global byte heuristic.
func modelContextWindows() map[string]int {
	out := map[string]int{}
	for _, dir := range []string{
		os.Getenv("HOME") + "/.pi/agent",
		"/home/symetrix/.pi/agent",
	} {
		data, err := os.ReadFile(dir + "/models.json")
		if err != nil {
			continue
		}
		var parsed struct {
			Providers map[string]json.RawMessage `json:"providers"`
		}
		if json.Unmarshal(data, &parsed) != nil {
			continue
		}
		for prov, raw := range parsed.Providers {
			var models []struct {
				ID            string `json:"id"`
				ContextWindow int    `json:"contextWindow"`
			}
			if json.Unmarshal(raw, &models) != nil {
				continue
			}
			for _, m := range models {
				if m.ContextWindow > 0 {
					out[prov+"/"+m.ID] = m.ContextWindow
				}
			}
		}
	}
	return out
}

// sessionContextUsage returns (usedTokens, contextWindow, ok): the session's
// last measured totalTokens and its model's contextWindow.
func sessionContextUsage(path string, windows map[string]int) (int, int, bool) {
	f, err := os.Open(path)
	if err != nil {
		return 0, 0, false
	}
	defer f.Close()
	var provider, modelID string
	var used int
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	for sc.Scan() {
		var e struct {
			Type     string `json:"type"`
			Provider string `json:"provider"`
			ModelID  string `json:"modelId"`
			Message  *struct {
				Role  string `json:"role"`
				Usage *struct {
					TotalTokens int `json:"totalTokens"`
				} `json:"usage"`
			} `json:"message"`
		}
		if json.Unmarshal(sc.Bytes(), &e) != nil {
			continue
		}
		if e.Provider != "" {
			provider = e.Provider
		}
		if e.ModelID != "" {
			modelID = e.ModelID
		}
		if e.Type == "message" && e.Message != nil && e.Message.Role == "assistant" && e.Message.Usage != nil && e.Message.Usage.TotalTokens > 0 {
			used = e.Message.Usage.TotalTokens
		}
	}
	if modelID == "" || used == 0 {
		return 0, 0, false
	}
	cw, ok := windows[provider+"/"+modelID]
	return used, cw, ok
}

func (s *Server) compactionSweepPass(ctx context.Context) {
	entries, err := os.ReadDir(s.sessionsDir)
	if err != nil {
		return
	}
	windows := modelContextWindows()
	var candidates []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if time.Since(info.ModTime()) < compactionSweepMinAge {
			continue
		}
		path := filepath.Join(s.sessionsDir, e.Name())
		if used, cw, ok := sessionContextUsage(path, windows); ok {
			// Per-model: compact when the session is near ITS model's window.
			if float64(used) < float64(cw)*compactionSweepThreshold {
				continue
			}
		} else if info.Size() < compactionFallbackBytes {
			// No model/usage data: fall back to the old size heuristic.
			continue
		}
		candidates = append(candidates, path)
	}
	// Oldest first: the most stale sessions go first.
	for i := 0; i < len(candidates); i++ {
		for j := i + 1; j < len(candidates); j++ {
			ii, _ := os.Stat(candidates[i])
			jj, _ := os.Stat(candidates[j])
			if ii != nil && jj != nil && jj.ModTime().Before(ii.ModTime()) {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}
	if len(candidates) > compactionSweepMaxPer {
		candidates = candidates[:compactionSweepMaxPer]
	}
	for _, path := range candidates {
		cctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
		_, err := rpc.OneShotSequence(cctx, []map[string]any{
			{"type": "switch_session", "sessionPath": path},
			{"type": "compact"},
		})
		cancel()
		if err != nil {
			log.Printf("[compaction-sweep] %s: %v", filepath.Base(path), err)
			continue
		}
		log.Printf("[compaction-sweep] compacted %s", filepath.Base(path))
	}
}
