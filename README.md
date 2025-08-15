# deepseek-exporter
based on logic of code from [BlakeHansen130 v0.0.6](https://greasyfork.org/en/scripts/523474), heavily edited for my usecase

### Original Features
- exporting individual chats as JSON or MD
- JSON files will include regenerations and/or edits of messages within the chat

## Current Features
- exporting individual chats as JSON or HTML
- JSON and HTML files will include regenerations and/or edits of messages within the chat
  - MD no longer included, as it can't represent regenerations/edits in an easy to read way
- exporting all chats as JSON or HTML in bulk
  - the script will be manually cycling though your chats, so don't be alarmed if deepseek starts switching chats on its own
- HTML files are formatted with css and js that *attempts* to look like deepseek. my skills are limited
- HTML files default to the branch with the longest chain of messages

samples for the generated files:
- [JSON](https://jsoneditoronline.org/#left=url.https%3A%2F%2Fraw.githubusercontent.com%2Fceyaima%2Fdeepseek-exporter%2Frefs%2Fheads%2Fmain%2Fsamples%2FDeepSeek%2520-%2520sample_2025-05-21T17-13-38.json&right=local.yemote)
- [HTML](https://htmlpreview.github.io/?https://raw.githubusercontent.com/ceyaima/deepseek-exporter/refs/heads/main/samples/DeepSeek%20-%20sample_2025-05-21T17-13-46.html)
> the prompts used for the sample were taken from eqbench.com

## Installation
1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Navigate to `deepseek-exporter.user.js` in the repo
3. Click `Raw`
