document.addEventListener('DOMContentLoaded', function() {
    const fetchBtn = document.getElementById('fetchBtn');
    const storyUrlInput = document.getElementById('storyUrl');
    const resultSection = document.getElementById('resultSection');
    const loading = document.getElementById('loading');
    const chaptersList = document.getElementById('chaptersList');
    
    // Các phần tử hiển thị thông tin truyện
    const coverImg = document.getElementById('coverImg');
    const storyTitle = document.getElementById('storyTitle');
    const storyAuthor = document.getElementById('storyAuthor');
    const storyCategory = document.getElementById('storyCategory');
    const storyStatus = document.getElementById('storyStatus');
    const chapterCount = document.getElementById('chapterCount');
    const storyDescription = document.getElementById('storyDescription');
    
    // Xử lý sự kiện khi nhấn nút tải thông tin truyện
    fetchBtn.addEventListener('click', function() {
        const url = storyUrlInput.value.trim();
        
        if (!url) {
            alert('Vui lòng nhập URL truyện');
            return;
        }
        
        if (!url.includes('truyenfull.vision')) {
            alert('URL phải từ trang TruyenFull.Vision');
            return;
        }
        
        // Hiển thị loading
        loading.style.display = 'block';
        resultSection.style.display = 'none';
        
        // Gửi yêu cầu đến proxy server để lấy HTML
        fetchStoryData(url);
    });
    
    // Hàm lấy dữ liệu truyện
    async function fetchStoryData(url) {
        try {
            // Sử dụng CORS proxy để tránh lỗi CORS
            const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=';
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            
            if (!response.ok) {
                throw new Error('Không thể tải trang truyện');
            }
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Trích xuất thông tin truyện từ HTML
            const storyData = await extractStoryInfo(doc, url);
            
            // Hiển thị thông tin truyện
            displayStoryInfo(storyData);
            
            // Ẩn loading và hiển thị kết quả
            loading.style.display = 'none';
            resultSection.style.display = 'block';
            
        } catch (error) {
            console.error('Lỗi khi tải truyện:', error);
            loading.style.display = 'none';
            alert('Không thể tải thông tin truyện. Vui lòng thử lại sau. Lỗi: ' + error.message);
        }
    }
    
    // Hàm trích xuất thông tin truyện từ HTML
    async function extractStoryInfo(doc, baseUrl) {
        // Trích xuất tiêu đề
        const titleElement = doc.querySelector('h3.title[itemprop="name"]') || 
                           doc.querySelector('h1') || 
                           doc.querySelector('title');
        const title = titleElement ? titleElement.textContent.trim() : 'Không rõ tiêu đề';
        
        // Trích xuất tác giả
        const authorElement = doc.querySelector('a[itemprop="author"]');
        const author = authorElement ? authorElement.textContent.trim() : 'Không rõ tác giả';
        
        // Trích xuất thể loại
        const categoryElements = doc.querySelectorAll('a[itemprop="genre"]');
        const categories = Array.from(categoryElements).map(el => el.textContent.trim()).join(', ');
        
        // Trích xuất trạng thái
        const statusElement = doc.querySelector('.text-success');
        const status = statusElement ? statusElement.textContent.trim() : 'Đang cập nhật';
        
        // Trích xuất ảnh bìa
        const coverElement = doc.querySelector('img[itemprop="image"]');
        const cover = coverElement ? coverElement.src : 'https://via.placeholder.com/150x200.png?text=Không+có+ảnh';
        
        // Trích xuất mô tả
        const descElement = doc.querySelector('.desc-text[itemprop="description"]');
        const description = descElement ? descElement.textContent.trim() : 'Không có mô tả';
        
        // LẤY TẤT CẢ CHƯƠNG TỪ TẤT CẢ CÁC TRANG
        const allChapters = await getAllChaptersFromAllPages(doc, baseUrl);
        
        return {
            title: title,
            author: author,
            category: categories,
            status: status,
            chapterCount: allChapters.length,
            description: description,
            cover: cover,
            chapters: allChapters,
            baseUrl: baseUrl
        };
    }
    
    // HÀM: Lấy tất cả chương từ tất cả các trang
    async function getAllChaptersFromAllPages(firstPageDoc, baseUrl) {
        let allChapters = [];
        
        // Lấy chương từ trang đầu tiên
        const firstPageChapters = extractChaptersFromPage(firstPageDoc, baseUrl);
        allChapters = allChapters.concat(firstPageChapters);
        
        console.log(`Trang 1: ${firstPageChapters.length} chương`);
        
        // Kiểm tra có phân trang không
        const pagination = firstPageDoc.querySelector('.pagination');
        if (pagination) {
            const totalPages = getTotalPages(pagination);
            
            console.log(`Tổng số trang: ${totalPages}`);
            
            // Lấy chương từ các trang tiếp theo (bắt đầu từ trang 2)
            for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
                try {
                    // Tạo URL trang tiếp theo theo đúng định dạng của TruyenFull
                    const nextPageUrl = `${baseUrl.replace(/\/$/, '')}/trang-${pageNum}/#list-chapter`;
                    console.log(`Đang tải trang ${pageNum}: ${nextPageUrl}`);
                    
                    const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=';
                    const response = await fetch(proxyUrl + encodeURIComponent(nextPageUrl));
                    
                    if (response.ok) {
                        const html = await response.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const pageChapters = extractChaptersFromPage(doc, baseUrl);
                        
                        console.log(`Trang ${pageNum}: ${pageChapters.length} chương`);
                        allChapters = allChapters.concat(pageChapters);
                        
                        // Nghỉ giữa các request
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        console.log(`Không thể tải trang ${pageNum}, dừng lại`);
                        break; // Dừng nếu không tải được trang
                    }
                } catch (error) {
                    console.error(`Lỗi khi tải trang ${pageNum}:`, error);
                    break; // Dừng nếu có lỗi
                }
            }
        }
        
        console.log(`Tổng số chương đã lấy: ${allChapters.length}`);
        
        // Loại bỏ chương trùng lặp (nếu có)
        const uniqueChapters = [];
        const seenUrls = new Set();
        
        allChapters.forEach(chapter => {
            if (!seenUrls.has(chapter.url)) {
                seenUrls.add(chapter.url);
                uniqueChapters.push(chapter);
            }
        });
        
        console.log(`Số chương sau khi loại bỏ trùng: ${uniqueChapters.length}`);
        return uniqueChapters;
    }
    
    // HÀM: Lấy tổng số trang từ phân trang
    function getTotalPages(paginationElement) {
        // Tìm số trang lớn nhất trong phân trang
        const pageLinks = paginationElement.querySelectorAll('a');
        let maxPage = 1;
        
        pageLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.includes('/trang-')) {
                const pageMatch = href.match(/trang-(\d+)/);
                if (pageMatch) {
                    const pageNum = parseInt(pageMatch[1]);
                    if (pageNum > maxPage) {
                        maxPage = pageNum;
                    }
                }
            }
            
            // Cũng kiểm tra text content của link
            const text = link.textContent.trim();
            const textPageNum = parseInt(text);
            if (!isNaN(textPageNum) && textPageNum > maxPage) {
                maxPage = textPageNum;
            }
        });
        
        // Nếu không tìm thấy, thử tìm nút cuối cùng
        if (maxPage === 1) {
            const lastPageLink = paginationElement.querySelector('a:last-child');
            if (lastPageLink) {
                const lastPageText = lastPageLink.textContent.trim();
                const lastPageNum = parseInt(lastPageText);
                if (!isNaN(lastPageNum)) {
                    maxPage = lastPageNum;
                }
            }
        }
        
        console.log(`Tổng số trang xác định: ${maxPage}`);
        return maxPage;
    }
    
    // HÀM: Trích xuất chương từ một trang
    function extractChaptersFromPage(doc, baseUrl) {
        const chapterElements = doc.querySelectorAll('.list-chapter a');
        const chapters = [];
        
        chapterElements.forEach((chapterEl, index) => {
            const chapterUrl = chapterEl.href;
            const chapterTitle = chapterEl.textContent.trim();
            
            // Kiểm tra xem chương đã tồn tại chưa (tránh trùng lặp)
            const existingChapter = chapters.find(ch => ch.url === chapterUrl);
            if (!existingChapter) {
                chapters.push({
                    title: chapterTitle,
                    url: chapterUrl.startsWith('http') ? chapterUrl : new URL(chapterUrl, baseUrl).href,
                    index: chapters.length
                });
            }
        });
        
        return chapters;
    }
    
    // Hàm hiển thị thông tin truyện
    function displayStoryInfo(storyData) {
        coverImg.src = storyData.cover;
        storyTitle.textContent = storyData.title;
        storyAuthor.textContent = storyData.author;
        storyCategory.textContent = storyData.category;
        storyStatus.textContent = storyData.status;
        chapterCount.textContent = storyData.chapterCount;
        storyDescription.textContent = storyData.description;
        
        // Hiển thị danh sách chương (chỉ hiển thị, không có nút tải)
        chaptersList.innerHTML = '';
        
        // Thêm thông tin phân trang
        const paginationInfo = document.createElement('div');
        paginationInfo.className = 'pagination-info';
        paginationInfo.innerHTML = `Tổng số chương: ${storyData.chapters.length}`;
        chaptersList.appendChild(paginationInfo);
        
        // Chỉ hiển thị 50 chương đầu để tránh quá tải
        const displayChapters = storyData.chapters.slice(0, 50);
        displayChapters.forEach((chapter, index) => {
            const chapterItem = document.createElement('div');
            chapterItem.className = 'chapter-item';
            chapterItem.innerHTML = `
                <span>${(index + 1).toString().padStart(3, '0')}. ${chapter.title}</span>
            `;
            chaptersList.appendChild(chapterItem);
        });

        // Hiển thị thông báo nếu có nhiều chương hơn
        if (storyData.chapters.length > 50) {
            const infoItem = document.createElement('div');
            infoItem.className = 'chapter-item info';
            infoItem.innerHTML = `
                <span>... và ${storyData.chapters.length - 50} chương khác (sẽ được tải đầy đủ)</span>
            `;
            chaptersList.appendChild(infoItem);
        }

        // THÊM NÚT TẢI TẤT CẢ
        const downloadAllSection = document.createElement('div');
        downloadAllSection.className = 'download-all-section';
        downloadAllSection.innerHTML = `
            <button id="downloadAllBtn" class="download-all-btn">📚 Tải toàn bộ truyện (${storyData.chapters.length} chương) - MỘT FILE HTML</button>
            <div class="progress-container" id="progressContainer" style="display: none;">
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <div class="progress-text" id="progressText">Đang tải: 0/${storyData.chapters.length}</div>
            </div>
        `;
        chaptersList.parentNode.insertBefore(downloadAllSection, chaptersList.nextSibling);

        // THÊM SỰ KIỆN CHO NÚT TẢI TẤT CẢ
        document.getElementById('downloadAllBtn').addEventListener('click', function() {
            downloadAllChapters(storyData.chapters, storyData.title, storyData.baseUrl, storyData.author, storyData.category, storyData.description, storyData.cover);
        });
    }
    
    // Hàm tải tất cả chương - GỘP VÀO MỘT FILE HTML
    async function downloadAllChapters(chapters, storyTitle, baseUrl, author, category, description, cover) {
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        // Hiển thị progress bar
        downloadAllBtn.disabled = true;
        downloadAllBtn.textContent = 'Đang tải...';
        progressContainer.style.display = 'block';
        
        let completed = 0;
        const total = chapters.length;
        let successCount = 0;
        let errorCount = 0;
        
        // Tạo nội dung HTML tổng hợp
        let combinedHTML = createCombinedHTMLHeader(storyTitle, author, category, description, cover, total);
        
        for (let i = 0; i < chapters.length; i++) {
            try {
                const chapter = chapters[i];
                
                // Hiển thị tiến độ
                progressFill.style.width = `${(completed / total) * 100}%`;
                progressText.textContent = `Đang tải: ${completed}/${total} - ${chapter.title.substring(0, 30)}...`;
                
                // Tải nội dung chương với timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 giây timeout
                
                try {
                    const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=';
                    const response = await fetch(proxyUrl + encodeURIComponent(chapter.url), {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    // Trích xuất nội dung chương
                    const chapterContent = extractChapterContent(doc);
                    const cleanContent = cleanChapterContent(chapterContent);
                    
                    // Thêm chương vào nội dung tổng hợp
                    combinedHTML += createChapterSection(chapter, cleanContent, i + 1);
                    
                    successCount++;
                    
                } catch (fetchError) {
                    // Thêm chương lỗi
                    combinedHTML += createErrorChapterSection(chapter, fetchError.message, i + 1);
                    errorCount++;
                }
                
                completed++;
                
                // Cập nhật tiến độ
                progressFill.style.width = `${(completed / total) * 100}%`;
                progressText.textContent = `Đang tải: ${completed}/${total} (Thành công: ${successCount}, Lỗi: ${errorCount})`;
                
                // Nghỉ giữa các request để tránh bị block
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                console.error(`Lỗi khi xử lý chương ${i + 1}:`, error);
                combinedHTML += createErrorChapterSection(chapters[i], error.message, i + 1);
                errorCount++;
                completed++;
                progressFill.style.width = `${(completed / total) * 100}%`;
                progressText.textContent = `Lỗi chương ${i + 1}, tiếp tục... (Thành công: ${successCount}, Lỗi: ${errorCount})`;
            }
        }
        
        // Hoàn thành - thêm footer và tạo file
        try {
            progressText.textContent = 'Đang tạo file HTML...';
            
            combinedHTML += createCombinedHTMLFooter(successCount, errorCount);
            
            // Tạo file HTML
            const blob = new Blob([combinedHTML], { type: 'text/html; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${storyTitle.replace(/[<>:"/\\|?*]/g, '_')}_full.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            progressText.textContent = `Hoàn thành! Đã tải ${successCount}/${total} chương thành công, ${errorCount} lỗi`;
            
        } catch (error) {
            console.error('Lỗi khi tạo file HTML:', error);
            progressText.textContent = 'Lỗi khi tạo file HTML';
        }
        
        // Reset trạng thái
        setTimeout(() => {
            downloadAllBtn.disabled = false;
            downloadAllBtn.textContent = `📚 Tải toàn bộ truyện (${total} chương) - MỘT FILE HTML`;
            progressContainer.style.display = 'none';
        }, 5000);
    }
    
    // HÀM: Tạo header cho file HTML tổng hợp
    function createCombinedHTMLHeader(title, author, category, description, cover, totalChapters) {
        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Toàn bộ truyện</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; line-height: 1.8; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; color: #333; }
        .header { text-align: center; margin-bottom: 40px; padding: 30px; background: white; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .story-title { color: #2c3e50; font-size: 2.2em; margin-bottom: 15px; }
        .story-info { color: #7f8c8d; margin: 10px 0; font-size: 1.1em; }
        .cover-img { max-width: 200px; margin: 20px auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
        .description { text-align: left; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; line-height: 1.6; }
        .chapter-title { text-align: center; margin: 40px 0 20px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; font-size: 1.8em; }
        .chapter-content { background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-bottom: 40px; font-size: 18px; }
        .chapter-content p { margin-bottom: 20px; text-align: justify; text-indent: 2em; }
        .footer { text-align: center; margin-top: 40px; color: #7f8c8d; font-size: 0.9em; border-top: 1px solid #ddd; padding-top: 20px; }
        .toc { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .toc h2 { color: #2c3e50; margin-bottom: 15px; }
        .toc-list { list-style: none; }
        .toc-list li { margin: 8px 0; padding: 5px 0; border-bottom: 1px solid #eee; }
        .toc-list a { color: #3498db; text-decoration: none; }
        .toc-list a:hover { color: #2980b9; text-decoration: underline; }
        .error-chapter { background: #ffeaa7; border-left: 4px solid #e74c3c; }
        .error-message { color: #e74c3c; font-style: italic; margin-top: 10px; }
        @media (max-width: 600px) {
            body { padding: 10px; }
            .chapter-content { padding: 20px; font-size: 16px; }
            .story-title { font-size: 1.8em; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="story-title">${title}</h1>
        ${cover ? `<img src="${cover}" alt="Bìa truyện" class="cover-img">` : ''}
        <div class="story-info"><strong>Tác giả:</strong> ${author}</div>
        <div class="story-info"><strong>Thể loại:</strong> ${category}</div>
        <div class="story-info"><strong>Tổng số chương:</strong> ${totalChapters}</div>
        ${description ? `<div class="description"><strong>Mô tả:</strong> ${description}</div>` : ''}
    </div>
    
    <div class="toc">
        <h2>📖 Mục lục</h2>
        <ol class="toc-list" id="toc-list">
            <!-- Mục lục sẽ được tạo bằng JavaScript -->
        </ol>
    </div>
    
    <div id="chapters-content">`;
    }
    
    // HÀM: Tạo section cho một chương
    function createChapterSection(chapter, content, chapterNumber) {
        return `
    <div class="chapter-content" id="chapter-${chapterNumber}">
        <h2 class="chapter-title">Chương ${chapterNumber}: ${chapter.title}</h2>
        ${content}
    </div>`;
    }
    
    // HÀM: Tạo section cho chương bị lỗi
    function createErrorChapterSection(chapter, errorMessage, chapterNumber) {
        return `
    <div class="chapter-content error-chapter" id="chapter-${chapterNumber}">
        <h2 class="chapter-title">Chương ${chapterNumber}: ${chapter.title}</h2>
        <div class="error-message">
            <strong>⚠️ Không thể tải nội dung chương</strong><br>
            Lỗi: ${errorMessage}<br>
            URL: ${chapter.url}
        </div>
    </div>`;
    }
    
    // HÀM: Tạo footer cho file HTML tổng hợp
    function createCombinedHTMLFooter(successCount, errorCount) {
        return `
    </div>
    
    <div class="footer">
        <p>Được tải về từ TruyenFull.Vision</p>
        <p>Thời gian tải: ${new Date().toLocaleString('vi-VN')}</p>
        <p>Thống kê: ${successCount} chương thành công, ${errorCount} chương lỗi</p>
    </div>

    <script>
        // Tạo mục lục tự động
        const tocList = document.getElementById('toc-list');
        const chapters = document.querySelectorAll('.chapter-content');
        
        chapters.forEach((chapter, index) => {
            const chapterId = chapter.id;
            const chapterTitle = chapter.querySelector('.chapter-title').textContent;
            const listItem = document.createElement('li');
            listItem.innerHTML = '<a href="#' + chapterId + '">' + chapterTitle + '</a>';
            tocList.appendChild(listItem);
        });
        
        // Thêm nút back to top
        const backToTop = document.createElement('div');
        backToTop.innerHTML = '<button onclick="window.scrollTo({top: 0, behavior: \\'smooth\\'})" style="position: fixed; bottom: 20px; right: 20px; padding: 10px 15px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">↑ Lên đầu</button>';
        document.body.appendChild(backToTop);
    </script>
</body>
</html>`;
    }
    
    // Hàm trích xuất nội dung chương
    function extractChapterContent(doc) {
        let contentElement = doc.querySelector('#chapter-c.chapter-c');
        
        if (!contentElement) {
            contentElement = doc.querySelector('.chapter-c') || 
                           doc.querySelector('#chapter-c') ||
                           doc.querySelector('.chapter-content') ||
                           doc.querySelector('.content-chapter');
        }
        
        if (contentElement) {
            const elementsToRemove = contentElement.querySelectorAll(
                '.ads-responsive, .chapter-nav, .text-center, script, style, .ads-chapter-google-bottom'
            );
            elementsToRemove.forEach(el => el.remove());
            return contentElement.innerHTML;
        } else {
            const paragraphs = doc.querySelectorAll('p');
            let content = '';
            paragraphs.forEach(p => {
                if (p.textContent.trim().length > 50) {
                    content += p.outerHTML;
                }
            });
            return content || '<p>Không thể trích xuất nội dung chương</p>';
        }
    }
    
    // Hàm làm sạch nội dung chương
    function cleanChapterContent(content) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        
        const elementsToRemove = tempDiv.querySelectorAll(
            'script, style, .ads-responsive, .chapter-nav, .text-center, .ads-chapter-google-bottom, [id*="ads"], [class*="ads"]'
        );
        elementsToRemove.forEach(el => el.remove());
        
        const pElements = tempDiv.querySelectorAll('p');
        pElements.forEach(p => {
            if (!p.style.textIndent) {
                p.style.textIndent = '2em';
            }
        });
        
        return tempDiv.innerHTML;
    }

    // Thêm URL mẫu để dễ dàng thử nghiệm
    storyUrlInput.value = 'https://truyenfull.vision/toi-dua-vao-he-thong-an-dua-nang-do-nua-cai-gioi-giai-tri/';
});