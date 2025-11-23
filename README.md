# deepseek-exporter
based on logic of code from [BlakeHansen130 v0.0.6](https://greasyfork.org/en/scripts/523474), heavily edited for my usecase

## Installation
1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Navigate to `deepseek-exporter.user.js` in the repo
3. Click `Raw`

## Current Features
- exporting individual chats as RAW, JSON, HTML, or MD
- exporting chats in any available file type in bulk
  - the script will be manually cycling though your chats, so don't be alarmed if deepseek starts switching chats on its own
  - if your sidebar is not currently visible, the script will force it open

| name | filetype | thinking text | regenerations/edits | samples |
| -----|----------| --------------| --------------------| -------|
| RAW  | json     | ✅            | ✅ | [file](https://github.com/ceyaima/deepseek-exporter/blob/main/samples/DeepSeek%20-%20test_chat_raw_2025-11-22T15-53-07.json)/[preview](https://raw.githubusercontent.com/ceyaima/deepseek-exporter/refs/heads/main/samples/DeepSeek%20-%20test_chat_raw_2025-11-22T15-53-07%20(visualised).png) |
| JSON | json (n-ary tree) | ✅ | ✅ | [file](https://github.com/ceyaima/deepseek-exporter/blob/main/samples/DeepSeek%20-%20test_chat_2025-11-22T15-53-10.json)/[preview](https://raw.githubusercontent.com/ceyaima/deepseek-exporter/refs/heads/main/samples/DeepSeek%20-%20test_chat_2025-11-22T15-53-07%20(visualised).png) |
| HTML | html | ❌ | ✅ | [file](https://github.com/ceyaima/deepseek-exporter/blob/main/samples/DeepSeek%20-%20test_chat_2025-11-22T15-53-12.html)/[preview](https://htmlpreview.github.io/?https://raw.githubusercontent.com/ceyaima/deepseek-exporter/refs/heads/main/samples/DeepSeek%20-%20test_chat_2025-11-22T15-53-12.html) |
| MD | markdown | ✅ | ❌ | [file](https://github.com/ceyaima/deepseek-exporter/blob/main/samples/DeepSeek%20-%20test_chat_2025-11-22T15-53-10.md?plain=1)/[preview](https://github.com/ceyaima/deepseek-exporter/blob/main/samples/DeepSeek%20-%20test_chat_2025-11-22T15-53-10.md) |

`prompts for samples by eqbench.com`
`json previews by jsoncrack.com`

## Known Issues and Fixes
<i>for now, every known issue can be solved by refreshing the page and trying again</i>
