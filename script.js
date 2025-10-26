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
        
        // LẤY TẤT CẢ CHƯƠNG TỪ TẤT CẢ CÁC TRANG (SỬ DỤNG PHƯƠNG PHÁP BATCH ĐỂ TĂNG TỐC)
        const allChapters = await getAllChaptersOptimized(doc, baseUrl);
        
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
    
    // HÀM TỐI ƯU: Lấy tất cả chương với tốc độ nhanh hơn
    async function getAllChaptersOptimized(firstPageDoc, baseUrl) {
        let allChapters = [];
        
        // Lấy chương từ trang đầu tiên (theo đúng thứ tự)
        const firstPageChapters = extractChaptersFromPage(firstPageDoc, baseUrl);
        allChapters = allChapters.concat(firstPageChapters);
        
        console.log(`Trang 1: ${firstPageChapters.length} chương`);
        
        // Kiểm tra có phân trang không
        const totalPages = getTotalPagesOptimized(firstPageDoc);
        
        if (totalPages > 1) {
            console.log(`Tổng số trang: ${totalPages}`);
            
            // Tạo tất cả URL trang cùng lúc
            const pageUrls = [];
            for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
                const pageUrl = `${baseUrl.replace(/\/$/, '')}/trang-${pageNum}/#list-chapter`;
                pageUrls.push(pageUrl);
            }
            
            // Chia nhỏ thành các batch để tránh quá tải
            const batchSize = 3;
            for (let i = 0; i < pageUrls.length; i += batchSize) {
                const batch = pageUrls.slice(i, i + batchSize);
                console.log(`Đang tải batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(pageUrls.length/batchSize)}`);
                
                try {
                    const batchPromises = batch.map(url => fetchPageChapters(url));
                    const batchResults = await Promise.allSettled(batchPromises);
                    
                    batchResults.forEach((result, index) => {
                        if (result.status === 'fulfilled' && result.value) {
                            const pageChapters = result.value;
                            console.log(`Trang ${i + index + 2}: ${pageChapters.length} chương`);
                            allChapters = allChapters.concat(pageChapters);
                        } else {
                            console.log(`Lỗi trang ${i + index + 2}`);
                        }
                    });
                    
                    // Nghỉ giữa các batch
                    if (i + batchSize < pageUrls.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                } catch (error) {
                    console.error(`Lỗi batch ${Math.floor(i/batchSize) + 1}:`, error);
                }
            }
        }
        
        console.log(`Tổng số chương đã lấy: ${allChapters.length}`);
        
        // SẮP XẾP VÀ LOẠI BỎ TRÙNG LẶP
        const sortedChapters = sortAndRemoveDuplicates(allChapters);
        
        console.log(`Số chương sau khi sắp xếp và loại bỏ trùng: ${sortedChapters.length}`);
        return sortedChapters;
    }
    
    // HÀM MỚI: Sắp xếp và loại bỏ chương trùng lặp
    function sortAndRemoveDuplicates(chapters) {
        // Bước 1: Loại bỏ trùng lặp dựa trên URL
        const uniqueChapters = [];
        const seenUrls = new Set();
        
        chapters.forEach(chapter => {
            if (!seenUrls.has(chapter.url)) {
                seenUrls.add(chapter.url);
                uniqueChapters.push(chapter);
            }
        });
        
        // Bước 2: Sắp xếp theo index (thứ tự xuất hiện)
        uniqueChapters.sort((a, b) => a.index - b.index);
        
        // Bước 3: Đảm bảo thứ tự đúng bằng cách phân tích số chương từ tiêu đề
        return sortChaptersByNumber(uniqueChapters);
    }
    
    // HÀM MỚI: Sắp xếp chương theo số chương từ tiêu đề
    function sortChaptersByNumber(chapters) {
        return chapters.sort((a, b) => {
            // Trích xuất số chương từ tiêu đề
            const aNumber = extractChapterNumber(a.title);
            const bNumber = extractChapterNumber(b.title);
            
            // Nếu có thể trích xuất số, sắp xếp theo số
            if (aNumber !== null && bNumber !== null) {
                return aNumber - bNumber;
            }
            
            // Nếu không, sắp xếp theo index gốc
            return a.index - b.index;
        });
    }
    
    // HÀM MỚI: Trích xuất số chương từ tiêu đề
    function extractChapterNumber(title) {
        // Các pattern phổ biến cho số chương
        const patterns = [
            /chương\s*(\d+)/i,           // "Chương 1", "chương 123"
            /ch\.\s*(\d+)/i,             // "Ch. 1", "ch.123"
            /^(\d+):/,                   // "1: Tiêu đề"
            /^(\d+)\s*-/,                // "1 - Tiêu đề"
            /\[ch\.\s*(\d+)\]/i,         // "[Ch. 1]"
            /\(chương\s*(\d+)\)/i        // "(Chương 1)"
        ];
        
        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match && match[1]) {
                return parseInt(match[1]);
            }
        }
        
        // Nếu không tìm thấy số, trả về null
        return null;
    }
    
    // Hàm fetch từng trang chương
    async function fetchPageChapters(url) {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=';
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                return extractChaptersFromPage(doc, url);
            }
        } catch (error) {
            console.error(`Lỗi khi tải trang: ${url}`, error);
        }
        return [];
    }
    
    // HÀM TỐI ƯU: Lấy tổng số trang
    function getTotalPagesOptimized(doc) {
        // Phương pháp 1: Tìm trong phân trang
        const pagination = doc.querySelector('.pagination');
        if (pagination) {
            const pageLinks = pagination.querySelectorAll('a');
            let maxPage = 1;
            
            pageLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.includes('/trang-')) {
                    const pageMatch = href.match(/trang-(\d+)/);
                    if (pageMatch) {
                        const pageNum = parseInt(pageMatch[1]);
                        if (pageNum > maxPage) maxPage = pageNum;
                    }
                }
                
                const text = link.textContent.trim();
                const textPageNum = parseInt(text);
                if (!isNaN(textPageNum) && textPageNum > maxPage) {
                    maxPage = textPageNum;
                }
            });
            
            if (maxPage > 1) return maxPage;
        }
        
        // Phương pháp 2: Kiểm tra select phân trang
        const pageSelect = doc.querySelector('select[name="page"]');
        if (pageSelect) {
            const options = pageSelect.querySelectorAll('option');
            if (options.length > 0) {
                return options.length;
            }
        }
        
        return 1;
    }
    
    // HÀM: Trích xuất chương từ một trang (GIỮ NGUYÊN THỨ TỰ)
    function extractChaptersFromPage(doc, baseUrl) {
        const chapterElements = doc.querySelectorAll('.list-chapter a');
        const chapters = [];
        
        chapterElements.forEach((chapterEl, index) => {
            const chapterUrl = chapterEl.href;
            const chapterTitle = chapterEl.textContent.trim();
            
            // QUAN TRỌNG: Giữ nguyên thứ tự xuất hiện trên trang
            const globalIndex = chapters.length; // Thứ tự tuyệt đối
            
            chapters.push({
                title: chapterTitle,
                url: chapterUrl.startsWith('http') ? chapterUrl : new URL(chapterUrl, baseUrl).href,
                index: globalIndex, // Sử dụng index toàn cục
                pageOrder: index    // Thứ tự trong trang
            });
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
        paginationInfo.innerHTML = `
            <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                <strong>Tổng số chương: ${storyData.chapters.length}</strong>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                    Đã sắp xếp theo thứ tự từ chương 1 đến chương ${storyData.chapters.length}
                </div>
            </div>
        `;
        chaptersList.appendChild(paginationInfo);
        
        // HIỂN THỊ TOÀN BỘ MỤC LỤC ĐÃ SẮP XẾP
        const chaptersContainer = document.createElement('div');
        chaptersContainer.style.maxHeight = '400px';
        chaptersContainer.style.overflowY = 'auto';
        chaptersContainer.style.border = '1px solid #ddd';
        chaptersContainer.style.borderRadius = '5px';
        chaptersContainer.style.padding = '10px';
        chaptersContainer.style.background = 'white';
        
        storyData.chapters.forEach((chapter, index) => {
            const chapterItem = document.createElement('div');
            chapterItem.className = 'chapter-item';
            chapterItem.style.padding = '8px 5px';
            chapterItem.style.borderBottom = '1px solid #f0f0f0';
            chapterItem.style.display = 'flex';
            chapterItem.style.alignItems = 'center';
            chapterItem.style.fontSize = '0.9em';
            
            // Hiển thị số chương và tiêu đề
            const chapterNumber = index + 1;
            chapterItem.innerHTML = `
                <span style="min-width: 50px; color: #2c3e50; font-weight: bold; font-size: 0.85em;">Ch. ${chapterNumber.toString().padStart(3, '0')}</span>
                <span style="flex: 1; color: #555;">${chapter.title}</span>
            `;
            
            // Highlight các chương có số thứ tự không khớp
            const extractedNumber = extractChapterNumber(chapter.title);
            if (extractedNumber !== null && extractedNumber !== chapterNumber) {
                chapterItem.style.background = '#fff3cd';
                chapterItem.title = `Cảnh báo: Tiêu đề chương (${extractedNumber}) không khớp với thứ tự (${chapterNumber})`;
            }
            
            chaptersContainer.appendChild(chapterItem);
        });
        
        chaptersList.appendChild(chaptersContainer);

        // THÊM NÚT TẢI TẤT CẢ
        const downloadAllSection = document.createElement('div');
        downloadAllSection.className = 'download-all-section';
        downloadAllSection.style.marginTop = '20px';
        downloadAllSection.innerHTML = `
            <button id="downloadAllBtn" class="download-all-btn" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
                📚 Tải toàn bộ truyện (${storyData.chapters.length} chương) - MỘT FILE HTML
            </button>
            <div class="progress-container" id="progressContainer" style="display: none; margin-top: 15px;">
                <div class="progress-bar" style="width: 100%; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden;">
                    <div class="progress-fill" id="progressFill" style="height: 100%; background: #007bff; width: 0%; transition: width 0.3s;"></div>
                </div>
                <div class="progress-text" id="progressText" style="text-align: center; margin-top: 5px; font-size: 14px;">Đang tải: 0/${storyData.chapters.length}</div>
                <div class="progress-stats" id="progressStats" style="text-align: center; font-size: 12px; color: #666;"></div>
            </div>
        `;
        chaptersList.parentNode.insertBefore(downloadAllSection, chaptersList.nextSibling);

        // THÊM SỰ KIỆN CHO NÚT TẢI TẤT CẢ
        document.getElementById('downloadAllBtn').addEventListener('click', function() {
            downloadAllChaptersOptimized(storyData.chapters, storyData);
        });
    }
    
    // HÀM TẢI TẤT CẢ CHƯƠNG TỐI ƯU - TĂNG TỐC ĐỘ
    async function downloadAllChaptersOptimized(chapters, storyData) {
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressStats = document.getElementById('progressStats');
        
        // Hiển thị progress bar
        downloadAllBtn.disabled = true;
        downloadAllBtn.textContent = 'Đang tải...';
        progressContainer.style.display = 'block';
        
        let completed = 0;
        const total = chapters.length;
        let successCount = 0;
        let errorCount = 0;
        
        // Tạo nội dung HTML tổng hợp với mục lục đầy đủ
        let combinedHTML = createCombinedHTMLHeader(storyData, chapters);
        
        // TẢI NHIỀU CHƯƠNG CÙNG LÚC VỚI BATCH
        const batchSize = 2;
        const chapterBatches = [];
        
        for (let i = 0; i < chapters.length; i += batchSize) {
            chapterBatches.push(chapters.slice(i, i + batchSize));
        }
        
        for (let batchIndex = 0; batchIndex < chapterBatches.length; batchIndex++) {
            const batch = chapterBatches[batchIndex];
            
            try {
                // Tạo promises cho batch hiện tại
                const batchPromises = batch.map((chapter, indexInBatch) => {
                    const chapterIndex = batchIndex * batchSize + indexInBatch;
                    return fetchChapterContent(chapter, chapterIndex + 1);
                });
                
                // Chờ tất cả chương trong batch hoàn thành
                const batchResults = await Promise.allSettled(batchPromises);
                
                // Xử lý kết quả batch
                batchResults.forEach((result, indexInBatch) => {
                    const chapterIndex = batchIndex * batchSize + indexInBatch;
                    
                    if (result.status === 'fulfilled') {
                        const chapterHTML = result.value;
                        combinedHTML += chapterHTML;
                        successCount++;
                    } else {
                        const chapter = batch[indexInBatch];
                        combinedHTML += createErrorChapterSection(chapter, result.reason, chapterIndex + 1);
                        errorCount++;
                    }
                    
                    completed++;
                    
                    // Cập nhật tiến độ
                    const progressPercent = (completed / total) * 100;
                    progressFill.style.width = `${progressPercent}%`;
                    progressText.textContent = `Đang tải: ${completed}/${total}`;
                    progressStats.textContent = `Thành công: ${successCount} | Lỗi: ${errorCount} | Tốc độ: ${batchSize} chương/lần`;
                });
                
                // Nghỉ giữa các batch
                if (batchIndex < chapterBatches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
                
            } catch (batchError) {
                console.error(`Lỗi batch ${batchIndex + 1}:`, batchError);
                
                // Xử lý lỗi cho toàn bộ batch
                batch.forEach((chapter, indexInBatch) => {
                    const chapterIndex = batchIndex * batchSize + indexInBatch;
                    combinedHTML += createErrorChapterSection(chapter, batchError.message, chapterIndex + 1);
                    errorCount++;
                    completed++;
                });
                
                // Cập nhật tiến độ sau lỗi batch
                const progressPercent = (completed / total) * 100;
                progressFill.style.width = `${progressPercent}%`;
                progressText.textContent = `Đang tải: ${completed}/${total}`;
            }
        }
        
        // Hoàn thành - thêm footer và tạo file
        try {
            progressText.textContent = 'Đang tạo file HTML...';
            progressStats.textContent = 'Đang tạo mục lục và đóng gói...';
            
            combinedHTML += createCombinedHTMLFooter(successCount, errorCount, chapters.length);
            
            // Tạo file HTML
            const blob = new Blob([combinedHTML], { type: 'text/html; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${storyData.title.replace(/[<>:"/\\|?*]/g, '_')}_full.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            progressText.textContent = `Hoàn thành! Đã tạo file với ${successCount}/${total} chương`;
            progressStats.textContent = `Thành công: ${successCount} | Lỗi: ${errorCount} | Tỷ lệ: ${((successCount/total)*100).toFixed(1)}%`;
            
        } catch (error) {
            console.error('Lỗi khi tạo file HTML:', error);
            progressText.textContent = 'Lỗi khi tạo file HTML';
            progressStats.textContent = error.message;
        }
        
        // Reset trạng thái
        setTimeout(() => {
            downloadAllBtn.disabled = false;
            downloadAllBtn.textContent = `📚 Tải lại toàn bộ truyện (${total} chương) - MỘT FILE HTML`;
        }, 5000);
    }
    
    // Hàm tải nội dung chương
    async function fetchChapterContent(chapter, chapterNumber) {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 giây timeout
            
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
            
            return createChapterSection(chapter, cleanContent, chapterNumber);
            
        } catch (error) {
            throw error;
        }
    }
    
    // HÀM: Tạo header cho file HTML tổng hợp VỚI MỤC LỤC ĐẦY ĐỦ
    function createCombinedHTMLHeader(storyData, chapters) {
        // Tạo mục lục HTML - ĐẢM BẢO ĐÚNG THỨ TỰ
        let tocHTML = '';
        chapters.forEach((chapter, index) => {
            const chapterNumber = index + 1;
            tocHTML += `<li><a href="#chapter-${chapterNumber}">Chương ${chapterNumber}: ${chapter.title}</a></li>`;
        });
        
        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${storyData.title} - Toàn bộ truyện</title>
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
        .toc { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); max-height: 500px; overflow-y: auto; }
        .toc h2 { color: #2c3e50; margin-bottom: 15px; position: sticky; top: 0; background: white; padding: 10px 0; }
        .toc-list { list-style: none; }
        .toc-list li { margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
        .toc-list a { color: #3498db; text-decoration: none; display: block; padding: 5px 0; }
        .toc-list a:hover { color: #2980b9; text-decoration: underline; background: #f8f9fa; padding-left: 10px; border-radius: 3px; }
        .error-chapter { background: #ffeaa7; border-left: 4px solid #e74c3c; }
        .error-message { color: #e74c3c; font-style: italic; margin-top: 10px; }
        .back-to-top { position: fixed; bottom: 20px; right: 20px; padding: 10px 15px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 1000; }
        .back-to-top:hover { background: #2980b9; }
        @media (max-width: 600px) {
            body { padding: 10px; }
            .chapter-content { padding: 20px; font-size: 16px; }
            .story-title { font-size: 1.8em; }
            .toc { max-height: 300px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="story-title">${storyData.title}</h1>
        ${storyData.cover ? `<img src="${storyData.cover}" alt="Bìa truyện" class="cover-img">` : ''}
        <div class="story-info"><strong>Tác giả:</strong> ${storyData.author}</div>
        <div class="story-info"><strong>Thể loại:</strong> ${storyData.category}</div>
        <div class="story-info"><strong>Tổng số chương:</strong> ${chapters.length}</div>
        ${storyData.description ? `<div class="description"><strong>Mô tả:</strong> ${storyData.description}</div>` : ''}
    </div>
    
    <div class="toc">
        <h2>📖 Mục lục (${chapters.length} chương)</h2>
        <ol class="toc-list">
            ${tocHTML}
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
            URL: <a href="${chapter.url}" target="_blank">${chapter.url}</a>
        </div>
    </div>`;
    }
    
    // HÀM: Tạo footer cho file HTML tổng hợp
    function createCombinedHTMLFooter(successCount, errorCount, totalChapters) {
        const downloadTime = new Date().toLocaleString('vi-VN');
        const successRate = totalChapters > 0 ? ((successCount / totalChapters) * 100).toFixed(1) : 0;
        
        return `
    </div>
    
    <button class="back-to-top" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">↑ Lên đầu trang</button>
    
    <div class="footer">
        <p><strong>${successCount}/${totalChapters} chương được tải thành công (${successRate}%)</strong></p>
        <p>Được tải về từ TruyenFull.Vision</p>
        <p>Thời gian tải: ${downloadTime}</p>
        <p>Thống kê: ${successCount} chương thành công, ${errorCount} chương lỗi</p>
    </div>
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
                '.ads-responsive, .chapter-nav, .text-center, script, style, .ads-chapter-google-bottom, ins, iframe'
            );
            elementsToRemove.forEach(el => el.remove());
            return contentElement.innerHTML;
        } else {
            const paragraphs = doc.querySelectorAll('p');
            let content = '';
            paragraphs.forEach(p => {
                if (p.textContent.trim().length > 30) {
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
            'script, style, .ads-responsive, .chapter-nav, .text-center, .ads-chapter-google-bottom, [id*="ads"], [class*="ads"], ins, iframe, .adsbygoogle'
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
