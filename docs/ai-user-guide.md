# Using AI to Understand Platform Activity

The Activity service connects to AI assistants like Claude, letting you ask plain-language questions about what's happening across your platform—without needing to write queries or read through raw log files.

This guide covers what you can ask, how to get started, and practical examples for common situations.

---

## What this makes possible

Instead of digging through logs or asking your engineering team to run queries, you can ask questions like:

- *"Who deleted the api-gateway resource in production last Tuesday?"*
- *"What did alice@example.com change in the last 30 days?"*
- *"Was there anything unusual about activity on our platform last week compared to the week before?"*
- *"Show me a timeline of everything that happened to the billing service."*

The AI answers by searching through your platform's complete history of changes and events, then explaining what it found in plain English.

---

## Two ways to access it

### Claude Desktop (conversational)

This is the best option for non-developers. Once connected, you have a normal chat conversation with Claude and it can look up activity on your behalf.

**What it's good for:** Open-ended investigation, getting summaries, asking follow-up questions until you find what you need.

**Setup:** Ask your engineering team to connect Claude Desktop to the Activity service. They'll configure it once, and after that you simply open Claude and ask questions.

### Claude Code plugin (for developers)

This option lives inside a developer's coding environment and adds a `/investigate` command they can use while working. It's designed for engineers who want to check platform activity without switching tools.

**What it's good for:** Quick lookups during development, investigating issues that surfaced in code, writing policies that control how activity is described.

---

## What you can ask about

The AI has access to three types of information:

### Everything that happened (the complete record)

Every action taken on the platform—creating, updating, or deleting resources—is recorded. This is the complete, unfiltered history. You can ask questions like:

- *"Who made changes to the production database configuration in the last week?"*
- *"Show me all the deletions in the last 24 hours."*
- *"Were there any failed attempts to access our secrets?"*

### Human-readable activity summaries

When your team has set up activity descriptions for specific resource types, the AI can show you plain-language summaries like "Alice updated the HTTPProxy 'api-gateway' in production." These are easier to read than raw log entries.

- *"Give me a summary of what changed on our network configuration this month."*
- *"Who has been most active on the platform this week?"*
- *"Show me only changes made by humans, not automated systems."*

### Platform events and alerts

The platform records notable events—things like pods restarting, deployments failing, or resources running into issues. You can ask:

- *"Were there any warning events in the production namespace yesterday?"*
- *"What events happened around 3pm last Friday?"*

---

## Common scenarios

### Investigating an incident

When something goes wrong, the most urgent question is usually "what changed?" Start by telling the AI roughly when the problem started and what was affected:

> *"Something broke in the production namespace around 2pm yesterday. What changed in the last few hours before that?"*

The AI will search for changes in that window and present the most likely candidates. You can then ask follow-up questions:

> *"Who made that change?"*
> *"Had they made similar changes before?"*
> *"What exactly was different before and after?"*

---

### Understanding a team member's recent activity

If you need to understand what someone has been working on, or review changes before a handoff:

> *"Summarize everything bob@example.com changed in the last two weeks."*

The AI will break this down by day and by resource type, so you can see patterns at a glance.

---

### Spotting unusual activity

When something feels off but you're not sure what, a comparison can surface anomalies quickly:

> *"Compare this week's activity to last week. Was anything significantly different?"*

The AI will highlight resources or users with unusually high activity, things that appeared for the first time, or activity that dropped off unexpectedly.

---

### Compliance and audit reporting

For regular compliance reviews or audit requests:

> *"Generate a report of all changes made in the billing namespace over the last 30 days, grouped by who made them."*

The AI can produce a summary suitable for sharing, covering who acted, what they changed, and when. If you need the raw data exported, your engineering team can run the query with full output.

---

### Tracking a specific resource's history

When you want to understand the full lifecycle of something—when it was created, every change it went through, who touched it:

> *"Show me the complete history of the 'payment-service' configuration."*

The AI will walk through every recorded change in chronological order and can explain what was different between each version.

---

## Tips for getting better answers

**Be specific about what you're looking for.** The more context you give, the better. "What changed in production yesterday afternoon?" is clearer than "what happened recently?"

**Name the specific thing you're investigating.** If you know the name of the resource, the person involved, or the project, include it. "What happened to the 'api-gateway' resource in the networking area?" will return a much more focused answer than "what happened to our API?"

**Ask follow-up questions.** The AI remembers the conversation, so you can drill in progressively. Start broad, then narrow down based on what the AI shows you.

**Ask for a summary first.** For large time windows, ask for a summary before asking for full details. "Summarize changes in production last month" gives you an overview you can use to decide where to look deeper.

**Tell the AI what you already know.** If you have a hypothesis, share it: "I think the outage was caused by a configuration change around 4pm. Can you look for changes to the proxy configuration around that time?" This helps the AI focus its search.

---

## What to do when you don't get the answer you expected

**Nothing came back:** The event might have happened outside the default search window (usually the last 7 days). Try asking the AI to search a wider time range, or specify the date you're looking for.

**The summaries are empty:** Human-readable activity summaries only exist for resource types that your team has configured. If a resource type isn't covered yet, the complete record is still available—ask the AI to look in the full audit history instead.

**You can't see certain information:** Access to platform activity is controlled by your permissions. If the AI tells you it can't retrieve data for a particular area, contact your platform administrator to review your access level.

**The AI seems unsure:** If the AI hedges or says it can't find something, try rephrasing the question or providing more context. You can also ask the AI: "What information do you need from me to answer this better?"

---

## For developers: the `/investigate` command

If you're using Claude Code, the `datum-activity` plugin adds a quick investigation shortcut. Type `/investigate` followed by your question:

```
/investigate Who deleted the nginx deployment in production?
```

```
/investigate What changed in the billing namespace in the last 6 hours?
```

The plugin also includes two specialized modes:

- **Activity Analyst** — For investigation and historical research across all activity types
- **Timeline Designer** — For setting up how activity should be described for new resource types (requires technical knowledge of ActivityPolicy configuration)

---

## Further reading

- [CLI User Guide](./cli-user-guide.md) — For engineers who prefer running queries directly from the command line
- [Architecture Overview](./architecture/README.md) — How the Activity service is built
- [API Reference](./api.md) — Technical API specifications
