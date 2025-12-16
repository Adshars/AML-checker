Auth-Service
============

Serwis rejestracji organizacji i uzytkownikow dla platformy AML Checker. Generuje klucze API (apiKey, apiSecret) dla organizacji, zapisuje dane w MongoDB i wystawia health-check.

Stos i zaleznosci
- Node.js 18, Express 5, ES Modules
- Mongoose 9 + MongoDB 6
- bcryptjs (hash hasel i apiSecret), jsonwebtoken (przyszle logowanie), cors, dotenv

Srodowisko i konfiguracja
- `MONGO_URI` – adres MongoDB; w kodzie domyslnie `mongodb://localhost:27017/auth_db`.
- W docker-compose MONGO_URI budowany jest z danych z `.env` (uzytkownik, haslo, port, baza).
- Port aplikacji w kontenerze: 3000; mapowany zmienna `PORT_AUTH` (domyslnie 3002).

Uruchomienie lokalne
1) `npm install`
2) `node src/index.js` (opcjonalnie ustaw `MONGO_URI` w srodowisku)

Uruchomienie w Docker Compose
- W katalogu glowym projektu: `docker compose up --build auth-service`
- Endpointy beda dostepne na http://localhost:3002 (mapowanie PORT_AUTH:3000).

Endpointy
- `GET /health` – zwraca status serwisu i polaczenia z Mongo (`{ service, status, database }`).
- `POST /auth/register-organization` – rejestruje organizacje i admina, generuje `apiKey` i jednorazowo zwraca `apiSecret`.
	- Wymagane pola: `orgName`, `country`, `city`, `address`, `email`, `password`, `firstName`, `lastName`.
	- Walidacje: duplikat org (name), duplikat email; bledy 400. Blad serwera 500.
- `POST /auth/register-user` – dodaje uzytkownika do istniejacej organizacji.
	- Wymagane pola: `email`, `password`, `firstName`, `lastName`, `organizationId`.
	- Walidacje: istnienie organizationId, duplikat email; bledy 400/404; serwer 500.

Przyklady uzycia
- Health:
```bash
curl http://localhost:3002/health
```

- Rejestracja organizacji + admina:
```bash
curl -X POST http://localhost:3002/auth/register-organization \
	-H "Content-Type: application/json" \
	-d '{
		"orgName": "ACME Corp",
		"country": "PL",
		"city": "Warszawa",
		"address": "Prosta 1",
		"email": "admin@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Jan",
		"lastName": "Kowalski"
	}'
```

- Rejestracja uzytkownika (wymaga istniejacego `organizationId`):
```bash
curl -X POST http://localhost:3002/auth/register-user \
	-H "Content-Type: application/json" \
	-d '{
		"email": "user@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Anna",
		"lastName": "Nowak",
		"organizationId": "<ORG_ID>"
	}'
```

Struktura odpowiedzi (skrot)
- `/health`:
```json
{ "service": "auth-service", "status": "UP", "database": "Connected" }
```

- `/auth/register-organization` (przyklad):
```json
{
	"message": "Organization registered successfully",
	"organization": {
		"id": "<org_id>",
		"name": "ACME Corp",
		"location": "Warszawa, PL",
		"apiKey": "pk_live_...",
		"apiSecret": "sk_live_..."   // zwracany tylko raz
	},
	"user": {
		"id": "<user_id>",
		"fullName": "Jan Kowalski",
		"email": "admin@acme.test",
		"role": "admin"
	}
}
```

Jak to dziala (high level)
- `register-organization`: sprawdza duplikaty, generuje apiKey/apiSecret, hashuje secret i haslo, zapisuje Organization i User(admin); secret zwracany jednokrotnie.
- `register-user`: waliduje organizationId, sprawdza email, hashuje haslo, ustawia role `user` i zapisuje rekord.
- `/health`: raportuje stan serwisu i polaczenia Mongoose.

Ograniczenia i TODO
- Brak logowania, JWT i middleware autoryzacji.
- Brak rate limiting i walidacji schematow (Joi/Zod).
- Brak rotacji kluczy API, resetu hasel i audytu operacji.
