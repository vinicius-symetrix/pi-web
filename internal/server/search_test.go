package server

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pi-web/internal/sessions"
)

func writeSearchSession(t *testing.T, root, project, name string, lines []string) {
	t.Helper()
	dir := filepath.Join(root, project)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestHandleApiSearchFindsMessageText(t *testing.T) {
	root := t.TempDir()
	writeSearchSession(t, root, "proj", "s1.jsonl", []string{
		`{"type":"session","id":"u1","cwd":"/x"}`,
		`{"type":"message","timestamp":"2026-05-08T10:00:00Z","message":{"role":"user","content":"please analyze the WIN spread"}}`,
		`{"type":"message","timestamp":"2026-05-08T10:01:00Z","message":{"role":"assistant","content":[{"type":"text","text":"spread looked normal"}]}}`,
	})
	writeSearchSession(t, root, "proj", "s2.jsonl", []string{
		`{"type":"session","id":"u2"}`,
		`{"type":"message","timestamp":"2026-05-09T10:00:00Z","message":{"role":"user","content":"unrelated topic"}}`,
	})
	s := &Server{
		sessionsDir: root,
		cache:       sessions.NewCache(),
		now:         func() time.Time { return time.Date(2026, 5, 9, 11, 0, 0, 0, time.UTC) },
	}

	req := httptest.NewRequest("GET", "/api/search?q=spread", nil)
	w := httptest.NewRecorder()
	s.handleApiSearch(w, req)
	if w.Code != 200 {
		t.Fatalf("status = %d", w.Code)
	}
	var payload struct {
		Results []map[string]any `json:"results"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Results) != 1 {
		t.Fatalf("want 1 session hit, got %d: %s", len(payload.Results), w.Body.String())
	}
	if payload.Results[0]["id"] != "s1" {
		t.Fatalf("hit id = %v, want s1", payload.Results[0]["id"])
	}
	if count := payload.Results[0]["count"].(float64); count != 2 {
		t.Fatalf("count = %v, want 2", count)
	}
	if sn, _ := payload.Results[0]["snippet"].(string); !strings.Contains(sn, "spread") {
		t.Fatalf("snippet = %q", sn)
	}

	req = httptest.NewRequest("GET", "/api/search?q=s", nil)
	w = httptest.NewRecorder()
	s.handleApiSearch(w, req)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"results":[]`) {
		t.Fatalf("short query: code=%d body=%s", w.Code, w.Body.String())
	}
}
