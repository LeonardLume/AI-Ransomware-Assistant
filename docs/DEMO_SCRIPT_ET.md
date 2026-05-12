# Lühike esitlustekst MVP seminariks

Tere! Meie projekt on AI-assistent organisatsiooni lunavararünnakuteks valmisoleku hindamiseks. Probleem on selles, et väikestel ja keskmise suurusega organisatsioonidel ei ole sageli selget ülevaadet, kui valmis nad on lunavararünnakuks. Täielik infoturbe audit on kallis ja aeganõudev, aga esmase enesehindamise saab teha lihtsama tööriistaga.

MVP fookus on viiel domeenil: varukoopiad, MFA ja ligipääsud, patchimine, administraatoriõigused ning incident response. Need valisime eksperdi tagasiside ja usaldusväärsete allikate põhjal, nagu NIST CSF, CISA StopRansomware, NCSC ransomware guidance ja CIS Controls.

Tehniliselt koosneb lahendus FastAPI backend'ist ja Streamlit kasutajaliidesest. Küsimused ja skoorimisreeglid on eraldi JSON-failides. Kasutaja vastused salvestatakse sessiooni, seejärel arvutatakse domeenipõhised skoorid ja üldskoor. Skoor on reeglipõhine, mitte LLM-i suvaline hinnang.

AI osa on kahes kohas. Esiteks aitab LLM otsustada ja sõnastada täpsustavaid küsimusi, kui vastus on ebamäärane või osaline. Teiseks aitab LLM sõnastada raporti arusaadavasse eesti keelde. Kui päris LLM ei ole demo ajal kättesaadav, on olemas fallback, et töövoog ikkagi töötaks.

Demoks laeme näidisprofiili, kus on väike ettevõte osaliste turvameetmetega. Rakendus näitab skoori, riskitaset, domeenide hinnanguid, peamisi riske ja prioriteetseid järgmisi samme. Samuti näitame tehnilise läbipaistvuse vaadet, kus on kirjas, millised osad on AI-põhised ja millised reeglipõhised.

Oluline piirang: see MVP ei asenda päris infoturbe auditit. See on esimene enesehindamise tööriist, mis aitab aru saada, millised valdkonnad vajavad esimesena tähelepanu.
