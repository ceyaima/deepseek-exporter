# deepseek-exporter
based on logic of code from [BlakeHansen130 v0.0.6](https://greasyfork.org/en/scripts/523474), heavily edited for my usecase

## Installation
1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Navigate to `deepseek-exporter.user.js` in the repo
3. Click `Raw`

## Current Features
- exporting individual chats as RAW, JSON, or HTML
  - RAW (raw json) will be the format deepseek stores its chats in
  - JSON (tree json) will translate the raw json into an n-ary tree format
  - HTML will translate the json into a readable, interactive page
    - formatted with css and js that *attempts* to look like deepseek
    - default to the branch with the longest chain of messages
- all file types will include regenerations and edits
- all json files will include "thinking" text
- exporting chats in any available file type in bulk
  - the script will be manually cycling though your chats, so don't be alarmed if deepseek starts switching chats on its own
  - if your sidebar is not currently visible, the script will force it open

samples for the generated files:
- [RAW](https://github.com/ceyaima/deepseek-exporter/blob/main/samples/DeepSeek%20-%20test_chat_raw_2025-11-22T15-53-07.json)
- [JSON](https://github.com/ceyaima/deepseek-exporter/blob/main/samples/DeepSeek%20-%20test_chat_2025-11-22T15-53-10.json)
- [HTML](https://htmlpreview.github.io/?https://raw.githubusercontent.com/ceyaima/deepseek-exporter/refs/heads/main/samples/DeepSeek%20-%20test_chat_2025-11-22T15-53-12.html)
> the prompts used for the sample were taken from eqbench.com

## Known Issues and Fixes
<i>for now, every known issue can be solved by refreshing the page and trying again</i>
