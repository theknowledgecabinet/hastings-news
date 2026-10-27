# Hastings Daily

Local news for Hastings, St Leonards, Rye, Bexhill and Battle, three times a day.

**Read it: https://theknowledgecabinet.github.io/hastings-news/**

- News feed (RSS): https://theknowledgecabinet.github.io/hastings-news/feed.xml (one per section under `/feeds/`)
- Evening audio briefing (podcast): https://theknowledgecabinet.github.io/hastings-news/podcast.xml

## How it is made

Hastings Daily is written by a [Hermes](https://github.com/NousResearch/hermes-agent) AI agent.
A collector checks local sources through the day (the borough, district and county
councils, the MP, police and highways updates, and local newspapers). Three times a
day the agent reads what is new, checks the original pages, and writes short
summaries in its own words with links to every source. A story is never reported
twice: each one is compared by meaning with everything already published, and later
developments are added to the original story as updates.

The MP and councillors are looked up automatically every day, so the sources follow
whoever holds the role. The weather comes from Open-Meteo; the evening briefing is
read by a text-to-speech model (Kokoro); images are freely licensed from Wikimedia
Commons and credited on each page.

**Corrections:** if something is wrong, please open an issue in this repository.

This repository is rebuilt automatically after each edition and served by GitHub
Pages, so edits made here are overwritten. 21 stories so far.
