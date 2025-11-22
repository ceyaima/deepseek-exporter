// ==UserScript==
// @name         deepseek exporter
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  export deepseek chats in bulk as json or html
// @author       ceyaima
// @match        https://chat.deepseek.com/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// ==/UserScript==

(function() {
    'use strict';

    // -------------------------------
    // INTERNAL STATE & LOGGING
    // -------------------------------
    let state = {
        targetResponse: null,
        lastUpdateTime: null
    };

    const log = {
        info: (msg) => console.log(`[DeepSeek Saver] ${msg}`),
        error: (msg, e) => console.error(`[DeepSeek Saver] ${msg}`, e)
    };

    // -------------------------------
    // AUTO-SCROLL FUNCTIONALITY
    // -------------------------------
    async function loadAllChatsInSidebar() {
        return new Promise((resolve) => {
            const scrollContainer = document.querySelector('._6d215eb.ds-scroll-area');
            if (!scrollContainer) {
                log.info('No scrollable sidebar container found');
                resolve();
                return;
            }

            log.info('Starting enhanced auto-scroll to load all chats...');

            let lastChatCount = 0;
            let currentChatCount = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = 50; // Increased from 20
            const scrollDelay = 800; // Increased delay for slower loading
            let consecutiveNoChange = 0;
            const maxConsecutiveNoChange = 5; // Require 5 consecutive no-changes to stop

            function scrollAndCheck() {
                currentChatCount = document.querySelectorAll('._83421f9[tabindex="0"]').length;

                log.info(`Scroll ${scrollAttempts}: ${currentChatCount} chats (Previous: ${lastChatCount})`);

                // Check if we've reached a stable state
                if (currentChatCount === lastChatCount) {
                    consecutiveNoChange++;
                    log.info(`No change detected (${consecutiveNoChange}/${maxConsecutiveNoChange})`);

                    if (consecutiveNoChange >= maxConsecutiveNoChange) {
                        log.info(`All chats loaded. Total: ${currentChatCount}`);
                        resolve();
                        return;
                    }
                } else {
                    consecutiveNoChange = 0; // Reset counter when we see new content
                }

                // Safety check for max attempts
                if (scrollAttempts >= maxScrollAttempts) {
                    log.info(`Max scroll attempts reached. Loaded ${currentChatCount} chats`);
                    resolve();
                    return;
                }

                lastChatCount = currentChatCount;
                scrollAttempts++;

                // Enhanced scrolling - try different scroll strategies
                const scrollHeight = scrollContainer.scrollHeight;
                const clientHeight = scrollContainer.clientHeight;
                const scrollTop = scrollContainer.scrollTop;

                // Strategy 1: Scroll to very bottom
                scrollContainer.scrollTop = scrollHeight;

                // Strategy 2: If already near bottom, try scrolling by smaller increments
                if (scrollHeight - scrollTop - clientHeight < 100) {
                    // We're near bottom, try scrolling by viewport height
                    scrollContainer.scrollTop += clientHeight * 0.7;
                }

                // Wait longer for content to load, then check again
                setTimeout(scrollAndCheck, scrollDelay);
            }

            // Start the scroll process
            scrollAndCheck();
        });
    }

    // -------------------------------
    // HELPER FUNCTIONS FOR HTML EXPORT
    // -------------------------------
    function convertMarkdown(text) {
        return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                   .replace(/\*(.+?)\*/g, "<em>$1</em>");
    }

    function generateChatHTML(jsonData) {
        // Extract chat metadata and messages
        var chatTitle = jsonData.data.biz_data.chat_session.title;
        var chatCreated = jsonData.data.biz_data.chat_session.inserted_at;
        var chatUpdated = jsonData.data.biz_data.chat_session.updated_at;
        var chatId = jsonData.data.biz_data.chat_session.id;
        var allMessages = jsonData.data.biz_data.chat_messages;

        // FIX: The new JSON puts text in 'fragments', so we construct 'content' from that
        allMessages.forEach(function(m) {
            if (m.fragments) {
                m.content = m.fragments
                    .filter(function(f) {
                        return f.type === "RESPONSE" || f.type === "REQUEST";
                    })
                    .map(function(f) { return f.content; })
                    .join('\n\n');
            } else {
                m.content = "";
            }
        });

        // Filter out unwanted messages
        var filteredMessages = allMessages.filter(function(m) {
            var trimmed = (m.content || "").trim();
            return trimmed !== "The server is busy. Please try again later." && trimmed !== "";
        });

        // Group messages by parent_id
        var childrenByParent = {};
        filteredMessages.forEach(function(msg) {
            var pid = msg.parent_id;
            if (!childrenByParent[pid]) {
                childrenByParent[pid] = [];
            }
            childrenByParent[pid].push(msg);
        });

        function getMessagesOfRoleAndParent(role, pid) {
            var arr = (childrenByParent[pid] || []).filter(function(m) {
                return m.role === role;
            });
            arr.sort(function(a, b) { return a.message_id - b.message_id; });
            return arr;
        }

        // Recursively build conversation structure
        function buildConversationStructure(userMsg) {
            var structure = {
                type: "user",
                message: userMsg,
                assistant_generations: []
            };
            var u_id = userMsg.message_id;
            var assistantReplies = getMessagesOfRoleAndParent("ASSISTANT", u_id);
            assistantReplies.forEach(function(assistantMsg) {
                var userEdits = getMessagesOfRoleAndParent("USER", assistantMsg.message_id);
                var nextBranches = userEdits.map(buildConversationStructure);
                structure.assistant_generations.push({
                    type: "assistant",
                    message: assistantMsg,
                    next_user_edits: nextBranches
                });
            });
            return structure;
        }

        var rootUserMessages = filteredMessages.filter(function(m) {
            return m.role === "USER" && m.parent_id === null;
        });
        var conversationTrees = rootUserMessages.map(buildConversationStructure);

        function chainDepth(structure) {
            var base = 1;
            var children = (structure.type === "user") ? structure.assistant_generations || [] : structure.next_user_edits || [];
            var maxChild = 0;
            children.forEach(function(child) {
                var d = chainDepth(child);
                if (d > maxChild) { maxChild = d; }
            });
            return base + maxChild;
        }

        function defaultBranchIndex(branches) {
            function isLastBranch(branch) {
                if (branch.type === "assistant") {
                    return !(branch.next_user_edits && branch.next_user_edits.length > 0);
                } else if (branch.type === "user") {
                    return !(branch.assistant_generations && branch.assistant_generations.length > 0);
                }
                return true;
            }
            if (branches.length && branches.every(isLastBranch)) {
                return branches.length - 1;
            } else {
                var defaultIdx = 0, maxD = 0;
                branches.forEach(function(branch, idx) {
                    var d = chainDepth(branch);
                    if (d > maxD) { maxD = d; defaultIdx = idx; }
                });
                return defaultIdx;
            }
        }
        var defaultRootIndex = conversationTrees.length ? defaultBranchIndex(conversationTrees) : 0;

        // Build the HTML output step by step
        var htmlOutput = [];
        htmlOutput.push("<!DOCTYPE html>");
        htmlOutput.push("<html>");
        htmlOutput.push("<head>");
        htmlOutput.push("<meta charset='utf-8'/>");
        htmlOutput.push("<meta name='viewport' content='width=device-width, initial-scale=1.0'>");
        htmlOutput.push("<title>" + chatTitle + "</title>");
        htmlOutput.push("<style>");
        htmlOutput.push("@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');")
        htmlOutput.push("body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #151517; font-size: 11.5pt; line-height: 1.70; }");
        htmlOutput.push("h1 { text-align: center; color: #ccc; line-height: 1.2; font-size: 22pt; padding-bottom: 10px; margin-top: 30px; }");
        htmlOutput.push("h4 { color: #6f7680; text-align: center; font-family: 'Consolas', monospaced; font-size: 13pt; margin: 0; }");
        htmlOutput.push("::-webkit-scrollbar { width: 10px; }");
        htmlOutput.push("::-webkit-scrollbar-track { background: #151517; }");
        htmlOutput.push("::-webkit-scrollbar-thumb { background: #2c2c2e; }");
        htmlOutput.push("::-webkit-scrollbar-hover { background: #262431; }");
        htmlOutput.push(".chat-container { max-width: 800px; margin: 20px auto; padding: 0 20px; }");
        htmlOutput.push(".message-box { color: #e5e5e5; margin: 10px 0; margin-bottom: 40px; padding: 15px 25px; border-radius: 20px; max-width: 90%; position: relative; }");
        htmlOutput.push(".user-message { background-color: #2c2c2e; text-align: left; margin-left: auto; margin-right: 0; }");
        htmlOutput.push(".assistant-message { margin-left: 0; margin-right: auto; margin-bottom: 40px; }");
        htmlOutput.push(".toggle-container { margin: 5px 0 10px 0; font-size: 0.9em; color: #e5e5e5; }");
        htmlOutput.push(".toggle-container.assistant-toggle { text-align: left; }");
        htmlOutput.push(".toggle-container.user-toggle { text-align: right; }");
        htmlOutput.push(".toggle-container.root-toggle { text-align: right; }");
        htmlOutput.push(".arrow { cursor: pointer; margin: 0 10px; font-weight: bold; }");
        htmlOutput.push(".hidden { display: none; }");
        htmlOutput.push("</style>");
        htmlOutput.push("</head>");
        htmlOutput.push("<body>");
        htmlOutput.push("<div class='chat-container'>");
        htmlOutput.push("<h1>" + chatTitle + "</h1>");
        htmlOutput.push("<h4>id: " + chatId + "</h4>");
        var createdStr = new Date(chatCreated * 1000).toISOString().slice(0,19).replace("T", " ");
        var updatedStr = new Date(chatUpdated * 1000).toISOString().slice(0,19).replace("T", " ");
        htmlOutput.push("<em><h4>chat created: " + createdStr + "</h4></em>");
        htmlOutput.push("<em><h4>chat updated: " + updatedStr + "</h4></em>");

        var globalEditGroupId = 0;
        function escapeContent(text) {
            var div = document.createElement('div');
            div.textContent = text;
            var escaped = div.innerHTML;
            escaped = escaped.replace(/\n/g, "<br>");
            escaped = convertMarkdown(escaped);
            return escaped;
        }

        function renderUserBlock(structureNode, parentDivId) {
            globalEditGroupId++;
            var userMsg = structureNode.message;
            var contentHtml = escapeContent(userMsg.content);
            var html = "";
            html += "<div class='message-box user-message'>" + contentHtml + "</div>";
            if (structureNode.assistant_generations && structureNode.assistant_generations.length) {
                var genList = structureNode.assistant_generations;
                if (genList.length === 1) {
                    html += renderAssistantBlock(genList[0], parentDivId);
                } else {
                    var defaultIdx = defaultBranchIndex(genList);
                    globalEditGroupId++;
                    var groupId = globalEditGroupId;
                    html += "<div class='toggle-container assistant-toggle'>";
                    html += "<span class='arrow' onclick='prevAssistantGen(" + groupId + ", " + genList.length + ")'>&larr;</span>";
                    html += "<span id='assistant_gen_counter_" + groupId + "'>" + (defaultIdx+1) + "/" + genList.length + "</span>";
                    html += "<span class='arrow' onclick='nextAssistantGen(" + groupId + ", " + genList.length + ")'>&rarr;</span>";
                    html += "</div>";
                    html += "<div id='assistant_gen_group_" + groupId + "'>";
                    genList.forEach(function(branch, idx) {
                        var hideClass = idx === defaultIdx ? "" : "hidden";
                        html += "<div class='" + hideClass + "' id='assistant_gen_" + groupId + "_" + idx + "'>";
                        html += renderAssistantBlock(branch, parentDivId);
                        html += "</div>";
                    });
                    html += "</div>";
                }
            }
            return html;
        }

        function renderAssistantBlock(structureNode, parentDivId) {
            globalEditGroupId++;
            var assistantMsg = structureNode.message;
            var contentHtml = escapeContent(assistantMsg.content);
            var html = "";
            html += "<div class='message-box assistant-message'>" + contentHtml + "</div>";
            if (structureNode.next_user_edits && structureNode.next_user_edits.length) {
                var edits = structureNode.next_user_edits;
                if (edits.length === 1) {
                    html += renderUserBlock(edits[0], parentDivId);
                } else {
                    var defaultIdx = defaultBranchIndex(edits);
                    globalEditGroupId++;
                    var groupId = globalEditGroupId;
                    html += "<div class='toggle-container user-toggle'>";
                    html += "<span class='arrow' onclick='prevUserEdit(" + groupId + ", " + edits.length + ")'>&larr;</span>";
                    html += "<span id='user_edit_counter_" + groupId + "'>" + (defaultIdx+1) + "/" + edits.length + "</span>";
                    html += "<span class='arrow' onclick='nextUserEdit(" + groupId + ", " + edits.length + ")'>&rarr;</span>";
                    html += "</div>";
                    html += "<div id='user_edits_group_" + groupId + "'>";
                    edits.forEach(function(branch, idx) {
                        var hideClass = idx === defaultIdx ? "" : "hidden";
                        html += "<div class='" + hideClass + "' id='user_edit_" + groupId + "_" + idx + "'>";
                        html += renderUserBlock(branch, parentDivId);
                        html += "</div>";
                    });
                    html += "</div>";
                }
            }
            return html;
        }

        if (conversationTrees.length > 1) {
            globalEditGroupId++;
            var rootGroupId = globalEditGroupId;
            var rootCount = conversationTrees.length;
            htmlOutput.push("<div class='toggle-container root-toggle'>");
            htmlOutput.push("<span class='arrow' onclick='prevRootEdit(" + rootGroupId + ", " + rootCount + ")'>&larr;</span>");
            htmlOutput.push("<span id='root_edit_counter_" + rootGroupId + "'>" + (defaultRootIndex+1) + "/" + rootCount + "</span>");
            htmlOutput.push("<span class='arrow' onclick='nextRootEdit(" + rootGroupId + ", " + rootCount + ")'>&rarr;</span>");
            htmlOutput.push("</div>");
            htmlOutput.push("<div id='root_edits_group_" + rootGroupId + "'>");
            conversationTrees.forEach(function(tree, idx) {
                var hideClass = idx === defaultRootIndex ? "" : "hidden";
                htmlOutput.push("<div class='" + hideClass + "' id='root_edit_" + rootGroupId + "_" + idx + "'>");
                htmlOutput.push(renderUserBlock(tree, "root_edits_group_" + rootGroupId));
                htmlOutput.push("</div>");
            });
            htmlOutput.push("</div>");
        } else {
            if (conversationTrees.length) {
                htmlOutput.push(renderUserBlock(conversationTrees[0], "root_container"));
            }
        }

        htmlOutput.push("</div>");
        htmlOutput.push("<script>");
        htmlOutput.push("function showDiv(divId) { document.getElementById(divId).classList.remove('hidden'); }");
        htmlOutput.push("function hideDiv(divId) { document.getElementById(divId).classList.add('hidden'); }");
        htmlOutput.push("function prevAssistantGen(groupId, total) { var currentIndex = getCurrentAssistantGenIndex(groupId, total); var newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex; switchAssistantGen(groupId, currentIndex, newIndex, total); }");
        htmlOutput.push("function nextAssistantGen(groupId, total) { var currentIndex = getCurrentAssistantGenIndex(groupId, total); var newIndex = currentIndex < (total - 1) ? currentIndex + 1 : currentIndex; switchAssistantGen(groupId, currentIndex, newIndex, total); }");
        htmlOutput.push("function getCurrentAssistantGenIndex(groupId, total) { for (var i = 0; i < total; i++) { var divId = 'assistant_gen_' + groupId + '_' + i; if (!document.getElementById(divId).classList.contains('hidden')) { return i; } } return 0; }");
        htmlOutput.push("function switchAssistantGen(groupId, oldIndex, newIndex, total) { hideDiv('assistant_gen_' + groupId + '_' + oldIndex); showDiv('assistant_gen_' + groupId + '_' + newIndex); document.getElementById('assistant_gen_counter_' + groupId).innerText = (newIndex+1) + '/' + total; }");
        htmlOutput.push("function prevUserEdit(groupId, total) { var currentIndex = getCurrentUserEditIndex(groupId, total); var newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex; switchUserEdit(groupId, currentIndex, newIndex, total); }");
        htmlOutput.push("function nextUserEdit(groupId, total) { var currentIndex = getCurrentUserEditIndex(groupId, total); var newIndex = currentIndex < (total - 1) ? currentIndex + 1 : currentIndex; switchUserEdit(groupId, currentIndex, newIndex, total); }");
        htmlOutput.push("function getCurrentUserEditIndex(groupId, total) { for (var i = 0; i < total; i++) { var divId = 'user_edit_' + groupId + '_' + i; if (!document.getElementById(divId).classList.contains('hidden')) { return i; } } return 0; }");
        htmlOutput.push("function switchUserEdit(groupId, oldIndex, newIndex, total) { hideDiv('user_edit_' + groupId + '_' + oldIndex); showDiv('user_edit_' + groupId + '_' + newIndex); document.getElementById('user_edit_counter_' + groupId).innerText = (newIndex+1) + '/' + total; }");
        htmlOutput.push("function prevRootEdit(groupId, total) { var currentIndex = getCurrentRootEditIndex(groupId, total); var newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex; switchRootEdit(groupId, currentIndex, newIndex, total); }");
        htmlOutput.push("function nextRootEdit(groupId, total) { var currentIndex = getCurrentRootEditIndex(groupId, total); var newIndex = currentIndex < (total - 1) ? currentIndex + 1 : currentIndex; switchRootEdit(groupId, currentIndex, newIndex, total); }");
        htmlOutput.push("function getCurrentRootEditIndex(groupId, total) { for (var i = 0; i < total; i++) { var divId = 'root_edit_' + groupId + '_' + i; if (!document.getElementById(divId).classList.contains('hidden')) { return i; } } return 0; }");
        htmlOutput.push("function switchRootEdit(groupId, oldIndex, newIndex, total) { hideDiv('root_edit_' + groupId + '_' + oldIndex); showDiv('root_edit_' + groupId + '_' + newIndex); document.getElementById('root_edit_counter_' + groupId).innerText = (newIndex+1) + '/' + total; }");
        htmlOutput.push("</script>");
        htmlOutput.push("</body></html>");
        return htmlOutput.join("\n");
    }
    // -------------------------------
    // END OF HTML EXPORT FUNCTIONS
    // -------------------------------

    // -------------------------------
    // PROCESS TARGET RESPONSE
    // -------------------------------
    function processTargetResponse(text, url) {
        try {
            if (text.length < 1024) {
                log.error('Cache failure, please send another message or clear your site data and re-login!');
                alert('Cache failure, please send another message or clear your site data and re-login!');
                return;
            }
            state.targetResponse = text;
            state.lastUpdateTime = new Date().toLocaleTimeString();
            updateButtonStatus();
            log.info(`Successfully captured target response (${text.length} bytes) from: ${url}`);
        } catch (e) {
            log.error('Error processing target response:', e);
        }
    }

    function updateButtonStatus() {
        const exportContainers = document.querySelectorAll('.export-container');
        exportContainers.forEach(function(container) {
            if (state.targetResponse) {
                container.title = `Last update: ${state.lastUpdateTime}\nData ready`;
            } else {
                container.title = 'Waiting for target response...';
            }
        });
    }

    // -------------------------------
    // CREATE BUTTONS & HOVER DROPDOWNS
    // -------------------------------
    function createButtons() {
        let buttonContainer = document.getElementById('dsButtonContainer');
        if (!buttonContainer) {
            buttonContainer = document.createElement('div');
            buttonContainer.id = 'dsButtonContainer';
            Object.assign(buttonContainer.style, {
                position: 'fixed',
                top: '10px',
                right: '10px',
                zIndex: '9999',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'opacity 0.3s ease'
            });
            document.body.appendChild(buttonContainer);
        }
        buttonContainer.innerHTML = '';

        // Common button style
        const buttonStyles = {
            padding: '8px 12px',
            backgroundColor: '#434057',
            color: '#ffffff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontFamily: 'Arial, sans-serif',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            whiteSpace: 'nowrap',
            fontSize: '14px'
        };

        // CSS for export container & dropdown (only visible on hover)
        const containerCSS = `
            .export-container {
                position: relative;
                display: inline-block;
            }
            .export-dropdown {
                display: none;
                position: absolute;
                left: -60%;
                top: 0;
                background-color: #434057;
                z-index: 10000;
                white-space: nowrap;
            }
            .export-dropdown div {
                padding: 8px 12px;
                cursor: pointer;
                color: #ffffff;
                font-size: 14px;
            }
            .export-dropdown div:hover {
                background-color: #212327;
            }
            .export-container:hover .export-dropdown {
                display: block;
            }
        `;
        // Inject the style if not already present
        if (!document.getElementById('exportDropdownStyles')) {
            let styleEl = document.createElement('style');
            styleEl.id = 'exportDropdownStyles';
            styleEl.innerHTML = containerCSS;
            document.head.appendChild(styleEl);
        }

        // Helper: create an export container for a given button text and click callback per export option.
        function createExportContainer(buttonText, exportHandler) {
            const container = document.createElement('div');
            container.className = 'export-container';
            // Create export button (no onclick; the dropdown options trigger export)
            const btn = document.createElement('button');
            btn.innerText = buttonText;
            Object.assign(btn.style, buttonStyles);
            container.appendChild(btn);

            // Create dropdown with options
            const dropdown = document.createElement('div');
            dropdown.className = 'export-dropdown';
            // Option: JSON
            const optionJSON = document.createElement('div');
            optionJSON.innerText = "JSON";
            optionJSON.onclick = function(e) {
                e.stopPropagation();
                exportHandler("json");
            };
            dropdown.appendChild(optionJSON);
            // Option: HTML
            const optionHTML = document.createElement('div');
            optionHTML.innerText = "HTML";
            optionHTML.onclick = function(e) {
                e.stopPropagation();
                exportHandler("html");
            };
            dropdown.appendChild(optionHTML);
            container.appendChild(dropdown);
            return container;
        }

        const currentURL = window.location.href;
        // For chat session pages:
        if (/^https:\/\/chat\.deepseek\.com\/a\/chat\/s\//.test(currentURL)) {
            const chatExportContainer = createExportContainer("Export Chat", function(format) {
                if (!state.targetResponse) {
                    alert('No valid chat record found. Please wait for a target response or engage in some conversation.');
                    return;
                }
                try {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    const jsonData = JSON.parse(state.targetResponse);
                    let chatTitle = jsonData.data.biz_data.chat_session.title || 'Untitled Chat';
                    chatTitle = chatTitle.replace(/[\/\\?%*:|"<>]/g, '-');
                    if (format === "json") {
                        const fileName = `DeepSeek - ${chatTitle}_${timestamp}.json`;
                        const blob = new Blob([state.targetResponse], { type: 'application/json' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = fileName;
                        link.click();
                        log.info(`Successfully downloaded file: ${fileName}`);
                    } else if (format === "html") {
                        const htmlData = generateChatHTML(jsonData);
                        const fileName = `DeepSeek - ${chatTitle}_${timestamp}.html`;
                        const blob = new Blob([htmlData], { type: 'text/html' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = fileName;
                        link.click();
                        log.info(`Successfully downloaded file: ${fileName}`);
                    }
                } catch (e) {
                    log.error('Error during export:', e);
                    alert('An error occurred during export. Please check the console for details.');
                }
            });
            buttonContainer.appendChild(chatExportContainer);
            updateButtonStatus();
        }
        // For non-chat pages: Export All
        const exportAllContainer = createExportContainer("Export All", function(format) {
            // Save the chosen format to localStorage so that after reload exportAllChats() uses it.
            localStorage.setItem("exportAllFormat", format);
            // Reload is necessary.
            localStorage.setItem("exportAllAfterReload", "true");
            location.replace("https://chat.deepseek.com");
        });
        buttonContainer.appendChild(exportAllContainer);
    }

    // -------------------------------
    // DELAY UTILITY FUNCTION
    // -------------------------------
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // -------------------------------
    // EXPORT ALL CHATS FUNCTION
    // -------------------------------
    async function exportAllChats() {
        log.info('Starting export all chats process...');

        // First, load all chats by auto-scrolling the sidebar
        await loadAllChatsInSidebar();

        const zip = new JSZip();

        // --- normal ---
        let chatElements = Array.from(document.querySelectorAll('._546d736'));

        // --- case 1 ---
        if (chatElements.length === 0) {
            const divAttempt2 = document.querySelector('.b8812f16.a2f3d50e._70b689f');
            if (divAttempt2) {
                divAttempt2.classList.remove('_70b689f');
                await delay(1000);
                await loadAllChatsInSidebar();
                chatElements = Array.from(document.querySelectorAll('._546d736'));
            }
        }

        // --- case 2 ---
        if (chatElements.length === 0) {
            console.log("Attempt 2 failed. Retrying with fix #2...");
            const divAttempt3 = document.querySelector('.dc04ec1d.a02af2e6');
            if (divAttempt3) {
                divAttempt3.classList.remove('a02af2e6');
                await delay(1000);
                await loadAllChatsInSidebar();
                chatElements = Array.from(document.querySelectorAll('._546d736'));
            }
        }

        // final check
        if (!chatElements.length) {
            alert('No chat items found in the sidebar after 3 attempts.');
            return;
        }

        log.info(`Found ${chatElements.length} chats to export.`);

        // Retrieve the saved export format from localStorage; default to json if not set.
        const exportFormat = localStorage.getItem("exportAllFormat") || "json";

        for (const chatEl of chatElements) {
            chatEl.click();
            state.targetResponse = null;
            let attempts = 0;
            while (!state.targetResponse && attempts < 10) {
                await delay(500);
                attempts++;
            }
            if (state.targetResponse) {
                try {
                    const jsonData = JSON.parse(state.targetResponse);
                    let chatTitle = jsonData.data.biz_data.chat_session.title || 'Untitled Chat';
                    chatTitle = chatTitle.replace(/[\/\\?%*:|"<>]/g, '-');
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    let fileName;
                    if (exportFormat === "json") {
                        fileName = `${chatTitle}_${timestamp}.json`;
                        zip.file(fileName, state.targetResponse);
                        log.info(`Added ${fileName} to zip`);
                    } else if (exportFormat === "html") {
                        fileName = `${chatTitle}_${timestamp}.html`;
                        const htmlData = generateChatHTML(jsonData);
                        zip.file(fileName, htmlData);
                        log.info(`Added ${fileName} to zip`);
                    }
                } catch(e) {
                    log.error("Error parsing JSON for a chat", e);
                }
            } else {
                log.error("Failed to load chat data for a chat element", chatEl);
            }
            await delay(500);
        }
        zip.generateAsync({type: "blob"}).then(function(content) {
            const a = document.createElement("a");
            const zipTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.href = URL.createObjectURL(content);
            a.download = `deepseek_chats_${zipTimestamp}.zip`;
            a.click();
            log.info("ZIP file download initiated.");
        });
    }

    // -------------------------------
    // INTERCEPT XHR TO CAPTURE JSON RESPONSES
    // -------------------------------
    const hookXHR = () => {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(...args) {
            if (args[1] && typeof args[1] === 'string' && args[1].includes('history_messages?chat_session_id') && args[1].includes('&cache_version=')) {
                args[1] = args[1].split('&cache_version=')[0];
            }
            this.addEventListener('load', function() {
                if (this.responseURL && this.responseURL.includes('history_messages?chat_session_id')) {
                    processTargetResponse(this.responseText, this.responseURL);
                }
            });
            originalOpen.apply(this, args);
        };
    };
    hookXHR();

    // -------------------------------
    // PATCH HISTORY METHODS TO DETECT URL CHANGES
    // -------------------------------
    const patchHistory = () => {
        const pushState = history.pushState;
        history.pushState = function() {
            pushState.apply(history, arguments);
            window.dispatchEvent(new Event('locationchange'));
        };
        const replaceState = history.replaceState;
        history.replaceState = function() {
            replaceState.apply(history, arguments);
            window.dispatchEvent(new Event('locationchange'));
        };
        window.addEventListener('popstate', () => {
            window.dispatchEvent(new Event('locationchange'));
        });
    };
    patchHistory();

    window.addEventListener('locationchange', () => {
        log.info("URL changed, updating buttons...");
        createButtons();
    });

    // -------------------------------
    // ON WINDOW LOAD: CREATE BUTTONS & CHECK FOR EXPORT ALL FLAG
    // -------------------------------
    window.addEventListener('load', function() {
        createButtons();
        if (localStorage.getItem("exportAllAfterReload") === "true") {
            localStorage.removeItem("exportAllAfterReload");
            // If exportAllFormat is set, run exportAllChats after reload.
            setTimeout(() => {
                exportAllChats();
            }, 1000);
        }
        const observer = new MutationObserver(() => {
            if (!document.getElementById('dsButtonContainer')) {
                log.info('Button container missing, recreating...');
                createButtons();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        log.info('DeepSeek Saver script with hover dropdown export and persistent Export All format started');
    });
})();
