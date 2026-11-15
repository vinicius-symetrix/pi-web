package server

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"pi-web/internal/sessions"
)

type searchHit struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Project string `json:"project"`
	When    string `json:"when"`
	Snippet string `json:"snippet"`
	Count   int    `json:"count"`
}

// snippetAround returns a rune-safe window of text around the first
// (byte-offset) match of q.
func snippetAround(text, q string) string {
	const radius = 60
	lower := strings.ToLower(text)
	i := strings.Index(lower, strings.ToLower(q))
	if i < 0 {
		return ""
	}
	runes := []rune(text)
	start := 0
	if i > radius {
		start = utf8.RuneCountInString(text[:i-radius])
	}
	end := start + utf8.RuneCountInString(q) + 2*radius
	if end > len(runes) {
		end = len(runes)
	}
	out := string(runes[start:end])
	if start > 0 {
		out = "…" + out
	}
	if end < len(runes) {
		out += "…"
	}
	return out
}

// handleApiSearch scans session transcripts for a text query. It matches
// message text (what renders in the chat), not tool internals or raw JSON.
// ponytail: linear scan of local JSONL per request, capped results; add an
// index only if hubs get slow.
func (s *Server) handleApiSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(q)) < 2 {
		writeJSON(w, http.StatusOK, map[string]any{"results": []searchHit{}})
		return
	}
	const scanLimit = 200
	const resultLimit = 30
	ql := strings.ToLower(q)

	summaries, _ := s.cache.LoadAll(s.sessionsDir)
	byID := make(map[string]sessions.SessionSummary, len(summaries)*3)
	for _, sum := range summaries {
		byID[sum.ID] = sum
		byID[sum.Filename] = sum
		byID[strings.TrimSuffix(sum.Filename, ".jsonl")] = sum
	}

	var hits []searchHit
	_ = filepath.WalkDir(s.sessionsDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".jsonl") {
			return nil
		}
		if len(hits) >= scanLimit {
			return filepath.SkipAll
		}
		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()

		rel, err := filepath.Rel(s.sessionsDir, path)
		if err != nil {
			rel = filepath.Base(path)
		}
		project := filepath.ToSlash(filepath.Dir(rel))
		if project == "." {
			project = ""
		}
		id := strings.TrimSuffix(filepath.Base(path), ".jsonl")

		hit := searchHit{ID: id, Project: project}
		if sum, ok := byID[id]; ok {
			hit.Title = sum.Name
			hit.Project = sum.Project
			hit.When = sum.LastActivity
		}

		scanner := bufio.NewScanner(f)
		scanner.Buffer(make([]byte, 64*1024), 256*1024*1024)
		found := false
		for scanner.Scan() {
			var entry map[string]any
			if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
				continue
			}
			text := sessions.EntryText(entry)
			if text == "" {
				continue
			}
			if !strings.Contains(strings.ToLower(text), ql) {
				continue
			}
			hit.Count++
			if !found {
				found = true
				hit.Snippet = snippetAround(text, q)
				if hit.When == "" {
					if ts, _ := entry["timestamp"].(string); ts != "" {
						hit.When = ts
					}
				}
			}
		}
		if found {
			hits = append(hits, hit)
		}
		return nil
	})

	sort.Slice(hits, func(i, j int) bool { return hits[i].When > hits[j].When })
	if len(hits) > resultLimit {
		hits = hits[:resultLimit]
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": hits})
}
