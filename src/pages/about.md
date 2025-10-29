---
title: About
permalink: /about/index.html
description: 'ToS Watch is inspired by my mom, who keeps asking if she should be concerned by ToS updates, and I always shrug, "yes".'
layout: page
---

Ever wonder what is hiding in that terms of service update? Let's find out. 

This site was inspired by the incident when Zoom [granted itself permission](https://therecord.media/zoom-ai-terms-of-service-update) to train AI's on user conversations and no one noticed for six months.

**Backend:**

Azure Functions periodically checks ToS documents for changes, computes difference between previous versions, prompts a LLM (Claude) to summarize the changes. ??? renders the summaries into static html pages.

**Frontend:**

This site is built using the [Eleventy](https://www.11ty.dev/) static site generator and the [Eleventy-Excellent](https://eleventy-excellent.netlify.app) theme.