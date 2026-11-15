package server

import (
	"net/http"

	"pi-web/internal/sessions"
	"pi-web/internal/share"
)

// shareCmdRunner is overridable in tests so the share handler doesn't shell out.
type shareCmdRunner interface {
	authStatus() error
	createGist(htmlPath string) (string, string, error) // returns (stdout, stderr)
}

type shareRunnerAdapter struct{ runner shareCmdRunner }

func (a shareRunnerAdapter) AuthStatus() error { return a.runner.authStatus() }
func (a shareRunnerAdapter) CreateGist(htmlPath string) (string, string, error) {
	return a.runner.createGist(htmlPath)
}

func (s *Server) handleShare(w http.ResponseWriter, r *http.Request) {
	// ponytail: gist share posts the conversation to github.com — off the
	// tailnet. Disabled in multi-user hubs; re-enable per-owner if ever needed.
	if s.multiUser {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "share disabled in multi-user mode"})
		return
	}
	var runner share.Runner
	if s.shareRunner != nil {
		runner = shareRunnerAdapter{runner: s.shareRunner}
	}
	share.Handle(w, r, share.Dependencies{
		Runner: runner,
		Resolve: func(id string) (sessions.Session, error) {
			resolved, err := sessions.ResolveByID(s.sessionsDir, id)
			if err != nil {
				return sessions.Session{}, err
			}
			return resolved.Session, nil
		},
		RenderExport: s.renderExportSession,
	})
}
