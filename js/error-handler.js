// ========== XỬ LÝ LỖI GIAO DIỆN ==========
// Chỉ hiển thị lỗi cho người dùng và ghi log kỹ thuật; không thay đổi dữ liệu.
window.onerror = function (message, source, lineno, colno, error) {
    console.error("Lỗi hệ thống:", message, source, lineno, colno, error);
    if (message === 'Script error.' || message === 'Script error') {
        return false;
    }
    const authErrorMsg = document.getElementById('authErrorMsg');
    const authContainer = document.getElementById('authContainer');
    if (authErrorMsg && authContainer && authContainer.style.display !== 'none') {
        authErrorMsg.textContent = 'Đã xảy ra lỗi hệ thống. Vui lòng tải lại trang và thử lại.';
        authErrorMsg.style.display = 'block';
        const btnSubmit = document.getElementById('btnAuthSubmit');
        if (btnSubmit) {
            btnSubmit.innerText = 'Đăng nhập';
            btnSubmit.disabled = false;
        }
    } else {
        alert("Lỗi hệ thống (JS Error):\n" + message + "\n\nTại: " + (source ? source.split('/').pop() : 'unknown') + " (Dòng " + lineno + ")");
        const tableBody = document.getElementById('tableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
                <b>Đã xảy ra lỗi hệ thống.</b><br>
                <small style="color: var(--text-muted);">Vui lòng tải lại trang và thử lại.</small>
            </td></tr>`;
        }
    }
    return false;
};
