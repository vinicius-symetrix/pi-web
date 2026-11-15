package server

import (
	"context"
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
	compactionSweepMinAge   = 24 * time.Hour
	compactionSweepMinBytes = 3 << 20 // 3 MB of JSONL ≈ very bloated context
	compactionSweepMaxPer   = 3       // sessions per pass; keep API spend bounded
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

func (s *Server) compactionSweepPass(ctx context.Context) {
	entries, err := os.ReadDir(s.sessionsDir)
	if err != nil {
		return
	}
	var candidates []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.Size() < compactionSweepMinBytes || time.Since(info.ModTime()) < compactionSweepMinAge {
			continue
		}
		candidates = append(candidates, filepath.Join(s.sessionsDir, e.Name()))
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
