from backend.config import llm_status


def test_llm_status_reports_openrouter_key_and_openai_base_url_mismatch(monkeypatch):
    monkeypatch.setenv("RRA_IGNORE_DOTENV", "1")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-or-v1-example")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    status = llm_status()

    assert status["provider"] == "openai"
    assert status["provider_ready"] is False
    assert "openrouter key" in str(status["reason"]).lower()
    assert "api.openai.com" in str(status["reason"]).lower()
