# AML Checker
> Mikroserwisowy do automatycznej weryfikacji klientow pod wzgledem sankcji i statusu PEP z wykorzystaniem lokalnej instancji OpenSanctions (Yente) oraz prostego modulu zarzadzania organizacjami/uzytkownikami.

## Table of Contents
* [General Information](#general-information)
* [Architecture](#architecture)
* [Technologies Used](#technologies-used)
* [Features](#features)
* [Setup](#setup)
* [Usage](#usage)
* [Project Status](#project-status)
* [Room for Improvement](#room-for-improvement)
* [Acknowledgements](#acknowledgements)
* [Contact](#contact)

## General Information
- Celem jest lokalne i powtarzalne srodowisko do sprawdzania klientow w bazie OpenSanctions oraz rejestrowania organizacji z kluczami API.
- Projekt korzysta z Yente jako lokalnego API (zasilanego manifestem [manifest.yml](manifest.yml)) oraz prostego serwisu auth do tworzenia organizacji i uzytkownikow.
- Srodowisko startuje przez Docker Compose, w tym MongoDB dla auth-service i Elasticsearch + Yente dla danych sankcyjnych.

## Architecture
- op-adapter: Ekspozycja koncowego endpointu GET `/check` nad Yente, mapowanie odpowiedzi, zdrowie pod `/health` ([op-adapter/src/index.js](op-adapter/src/index.js)). Port kontenera 3000, mapowany domyslnie na 3001.
- auth-service: Rejestracja organizacji i uzytkownikow, generacja kluczy API, zdrowie pod `/health`, routing w [auth-service/src/routes/authRoutes.js](auth-service/src/routes/authRoutes.js). Port kontenera 3000, mapowany zmienna `PORT_AUTH` (domyslnie 3002).
- yente: Obraz `ghcr.io/opensanctions/yente:5.1.0`, korzysta z Elasticsearch (single-node) i manifestu datasetow.
- Bazy danych: MongoDB (uzywane), PostgreSQL przygotowany pod core-service (brak implementacji), wolumeny na dane Yente/ES/Mongo/Postgres.

## Technologies Used
- Node.js 18, Express 5, ES Modules
- MongoDB 6 (Mongoose 9), PostgreSQL 15 (planowane)
- OpenSanctions Yente 5.1 + Elasticsearch 8.11
- Docker Compose 3.8
- axios, bcryptjs, jsonwebtoken (JWT zaleznosc jest, logowanie jeszcze niezaimplementowane)

## Features
- Weryfikacja sankcji/PEP przez endpoint GET `/check?name=` (op-adapter) z mappingiem wynikow Yente.
- Rejestracja organizacji wraz z generacja `apiKey` i jednorazowym ujawnieniem `apiSecret` (hash w bazie) oraz utworzeniem admina ([auth-service/src/routes/authRoutes.js](auth-service/src/routes/authRoutes.js)).
- Rejestracja uzytkownika powiazanego z istniejaca organizacja.
- Proste health-checki dla op-adapter, auth-service oraz Yente.
- Konfiguracja srodowiskowa przez [.env.example](.env.example) i wolumeny danych dla baz.

## Setup
1. Wymagania: Docker + Docker Compose. Opcjonalnie Node 18 do lokalnego uruchamiania pojedynczych serwisow.
2. Sklonuj repozytorium i skopiuj `.env.example` do `.env`, uzupelnij hasla/porty zgodnie z bezpieczenstwem.
3. Uruchom srodowisko: `docker compose up --build` w katalogu glownym.
4. Dostepne porty domyslne:
   - op-adapter: http://localhost:3001
   - auth-service: http://localhost:3002
   - Yente API: http://localhost:${YENTE_PORT} (domyslnie 8000)
   - Elasticsearch: http://localhost:9200 (debug)
5. Dane Yente sciagane sa przy starcie (patrz [manifest.yml](manifest.yml)); wolumeny `yente_data` i `es_data` przechowuja pobrane dane.

## Usage
- Health-checki:
  - `curl http://localhost:3001/health`
  - `curl http://localhost:3002/health`
- Rejestracja organizacji (admin + klucze API):
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
- Rejestracja uzytkownika w istniejacej organizacji (`organizationId` z odpowiedzi rejestracji organizacji):
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
- Sprawdzenie sankcji/PEP: 
```bash
curl "http://localhost:3001/check?name=John%20Doe"
```
Odpowiedz zawiera zmapowane flagi `isSanctioned`, `isPep`, pola `country`, `birthDate`, `notes` oraz `score` z Yente.

## Project Status
- Status: w toku. Dzialajace serwisy: op-adapter, auth-service. Brak implementacji core-service/frontend/infrastructure.

## Room for Improvement
- Dodac pelny flow logowania/JWT i middleware autoryzacji do istniejacych endpointow.
- Dopisac core-service do logowania historii zapytan (PostgreSQL) i ewentualne audyty.
- Dodac rate limiting, walidacje schematow i testy jednostkowe/integracyjne.
- Rozszerzyc frontend i dokumentacje API (OpenAPI/Swagger) dla serwisow.

## Acknowledgements
- OpenSanctions/Yente za udostepnienie datasetow i obrazu referencyjnego.

## Contact
- Autor uslug: Adam Weglewski (wg package.json op-adapter). W sprawach technicznych: otworz issue lub pull request w repozytorium.