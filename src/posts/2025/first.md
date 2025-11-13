---
title: 'ToS Watch v0.1'
description: "Going live with the site!"
date: 2025-11-11
layout: post
---

Yep. I'm publishing the site. 

## Motivation

This project spun out of conversations in the AI ethics space about data rights and model "evals". 

Most evals target on a model or a product: they ask "what capabilities does this **model** have?", "how can we safeguard this **model** so people don't misuse it?". This work is important, but misses an important lever.

ToS Watch is asking "what standards does this **company** hold itself to?"

## Ulterior motive

I also wanted to prove to myself (and potential employers) that I could build a moderately complex data pipeline. 

This site uses serverless and event-driven compute (Azure Functions App) for all back-end processing. Intermittent pipeline outputs are pulled and pushed to blob storage. The backend implements a stateful rate limiter (Azure Durable Function entity) to politely query historical policy snapshots from the Wayback Machine API and to prompt language model API's.

Final pipeline outputs are bundled into a static site using [Eleventy](https://www.11ty.dev/), running on Github Actions, and served via (??). The site theme was developed by [Eleventy-Excellent](https://eleventy-excellent.netlify.app).