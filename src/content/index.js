import { injectButton, setButtonLoading } from './button';
import { showLoading, showResult, showError, closeModal } from './modal';
function init() {
    injectButton((owner, repo) => {
        setButtonLoading(true);
        showLoading('Iniciando análise...', 0);
        chrome.runtime.sendMessage({
            type: 'ANALYZE_REPO',
            owner,
            repo,
        });
    });
}
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'ANALYSIS_PROGRESS') {
        showLoading(message.step, message.percent);
    }
    if (message.type === 'ANALYSIS_COMPLETE') {
        setButtonLoading(false);
        showResult(message.result);
    }
    if (message.type === 'ANALYSIS_ERROR') {
        setButtonLoading(false);
        showError(message.error, message.requiresApiKey);
    }
});
// Re-inject button after GitHub SPA navigation
let lastUrl = location.href;
const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        closeModal();
        setTimeout(init, 500);
    }
});
observer.observe(document.body, { subtree: true, childList: true });
init();
