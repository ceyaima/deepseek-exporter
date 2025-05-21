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

you can check a sample of the generated files [here](https://github.com/ceyaima/deepseek-exporter/tree/main/samples)
> the prompts used for the sample was taken from eqbench.com

## Installation
1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Download `deepseek-exporter.user.js` from the [Releases page](https://github.com/ceyaima/deepseek-exporter/releases/) or the repo
3. Open your chosen userscript manager
4. Upload the downloaded script

