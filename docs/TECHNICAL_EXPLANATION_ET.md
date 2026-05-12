# Tehniline selgitus küsimusteks

## Kuidas andmed liiguvad?

1. Streamlit frontend saadab `/session` päringu FastAPI backendile.
2. Backend loob in-memory sessiooni.
3. Frontend küsib `/interview/{session_id}/current`, backend tagastab järgmise vastamata põhiküsimuse.
4. Kasutaja vastus saadetakse `/answer` endpointi.
5. Backend valideerib `question_id` ja `answer` väärtuse.
6. Backend salvestab vastuse sessiooni.
7. `adaptive.py` kutsub LLM wrapperit, et otsustada, kas vaja on täpsustavat küsimust.
8. `/score/{session_id}` arvutab skoori `scoring_rules.json` põhjal.
9. `/report/{session_id}` koostab reeglipõhised riskid ja laseb LLM-il sõnastada raporti teksti.

## Miks skoor ei ole LLM-i teha?

Skoor peab olema kontrollitav ja põhjendatav. Kui LLM annaks otse skoori, oleks raske seletada, miks tuli näiteks 42/100. Seetõttu arvutatakse skoor deterministlikult reeglite alusel. LLM aitab ainult keelelist ja adaptiivset osa.

## Kuidas adaptiivne intervjuu töötab?

Intervjuu põhitee on fikseeritud: küsimused on `data/questions.json` failis. Kui vastus on `partial`, `unsure` või selgelt riskantne, küsib backend LLM-ilt, kas on vaja ühte täpsustavat küsimust. Kui jah, lisatakse sessiooni ajutine follow-up küsimus. Pärast seda liigub süsteem järgmise põhiküsimuse juurde.

## Mis mudelit kasutame?

MVP toetab kolme varianti:

- `fallback` — deterministlik tekstimall; töötab alati, ilma API-ta.
- `ollama` — lokaalne mudel, näiteks Qwen või Gemma.
- `openai` — API-põhine mudel, kui võti on olemas.

## Mis töötab praegu?

- End-to-end demo sisendist raportini.
- 5 domeeni ja 22 põhiküsimust.
- Reeglipõhine skoor.
- Completion rate ja preliminary/final eristus.
- Demo profiilid.
- Streamlit UI ja FastAPI docs.

## Mis vajab parandamist?

- Päris kasutajatega valideerimine.
- Rohkem testjuhtumeid.
- Parem LLM-i vastuste hindamine.
- Püsiv andmebaas SQLite/PostgreSQL.
- PDF eksport.
- Täpsem raporti kvaliteedi hindamine eksperdi poolt.
