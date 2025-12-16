OP-Adapter
==========

Lekki adapter HTTP nad lokalnym API OpenSanctions (Yente). Udostepnia jeden punkt wejsciowy do sprawdzania sankcji/PEP dla osoby lub podmiotu, mapuje odpowiedz Yente na uproszczony format oraz wystawia health-check.

Stos i zaleznosci
- Node.js 18, Express 5, ES Modules
- axios do komunikacji z Yente
- Domyslny port serwisu: 3000 (w docker-compose mapowany na 3001)

Srodowisko i konfiguracja
- Zmienna `YENTE_API_URL` (opcjonalna) wskazuje bazowy URL Yente; domyslnie `http://localhost:8000`.
- W docker-compose adres jest ustawiany na `http://yente:${YENTE_PORT}`.
- Serwis nie wymaga bazy danych ani dodatkowych sekretow.

Uruchomienie lokalne
1) `npm install`
2) `npm start`

Uruchomienie w Docker Compose
- W katalogu glowym projektu: `docker compose up --build op-adapter`
- Endpointy beda dostepne na http://localhost:3001 (mapowanie 3001:3000).

Endpointy
- `GET /health` – prosty health-check: `{ status, service, mode }`.
- `GET /check?name=<string>` – glowny endpoint weryfikacji.
	- Parametr: `name` (wymagany).
	- Zapytanie delegowane do Yente `/search/default` z limit=15, fuzzy=false.
	- Odpowiedz zawiera tablice obiektow z polami: `id`, `name`, `schema`, `isSanctioned`, `isPep`, `country`, `birthDate`, `notes`, `score`, plus metadane `source`, `timestamp`, `hits_count`.
	- Kody bledow: 400 (brak parametru), 502 (brak dostepu do Yente).

Przyklady uzycia
- Health:
```bash
curl http://localhost:3001/health
```

- Sprawdzenie osoby:
```bash
curl "http://localhost:3001/check?name=John%20Doe"
```

Struktura odpowiedzi
```json
{
	"meta": {
		"source": "OpenSanctions (Local Yente)",
		"timestamp": "2024-01-01T12:00:00.000Z"
	},
	"query": "John Doe",
	"hits_count": 2,
	"data": [
		{
			"id": "ocbid-123",
			"name": "John Doe",
			"schema": "Person",
			"isSanctioned": false,
			"isPep": true,
			"country": ["US"],
			"birthDate": ["1970-01-01"],
			"notes": [],
			"score": 0.92
		}
	]
}
```

Jak to dziala (high level)
- Endpoint `/check` wywoluje Yente z przekazanym zapytaniem `q=<name>`.
- Odpowiedz Yente jest mapowana: flagi `isSanctioned` na podstawie `topics` zawierajacego `sanction`, `isPep` na podstawie `role.pep`.
- Zwrocone sa wybrane pola properties (country, birthDate, notes) i score dla latwiejszej prezentacji w kliencie.

Ograniczenia i TODO
- Brak uwierzytelniania / rate limiting.
- Fuzzy search wylaczone (fuzzy=false) – mozna wlaczyc parametr.
- Brak paginacji; limit sztywno 15.
- Rozszerzyć zwracane pola