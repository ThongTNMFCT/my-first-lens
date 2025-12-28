// app.js - Phiên bản Final: Grid 3 Cột, Metadata thông minh & Tương tác

// 1. KIỂM TRA CẤU HÌNH
if (typeof CONFIG === 'undefined') { console.error("Thiếu config.js!"); }
if (!firebase.apps.length) firebase.initializeApp(CONFIG.firebase);

const db = firebase.firestore();

// Biến toàn cục quản lý trạng thái Lightbox
let currentPhotoId = null; 
let unsubscribeComments = null;
let unsubscribeLikes = null;

// 2. ROUTING & INIT
document.addEventListener('DOMContentLoaded', () => {
    // Trang Danh sách Album
    if (document.getElementById('album-list-container')) {
        loadAlbums();
    }
    
    // Trang Chi tiết Album
    if (document.getElementById('photo-container')) {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (id) {
            // Tải thông tin Album và Ảnh song song
            loadAlbumDataAndPhotos(id);
        } else {
            const t = document.getElementById('album-title');
            if(t) t.innerText = "Album không tồn tại";
        }
    }
});

// ==============================================
// 3. LOGIC TRANG COLLECTION (Danh sách Album)
// ==============================================
async function loadAlbums() {
    const container = document.getElementById('album-list-container');
    try {
        const snapshot = await db.collection('albums').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) { 
            container.innerHTML = `<div class="col-span-full text-center py-20"><p class="text-gray-400 font-serif italic text-xl" data-i18n="empty_album">Chưa có album nào.</p></div>`; 
            return; 
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            // Ảnh bìa: Lấy ảnh rộng (landscape)
            const cover = data.coverUrl 
                ? data.coverUrl.replace('/upload/', '/upload/w_1000,f_auto,q_auto/') 
                : 'https://via.placeholder.com/1000x560?text=No+Cover';
            
            // Format ngày từ timestamp hoặc field dateTaken
            let dateDisplay = "";
            if(data.dateTaken) {
                // Nếu có ngày cụ thể do user nhập
                const d = new Date(data.dateTaken);
                dateDisplay = d.toLocaleDateString('en-GB'); 
            } else if(data.createdAt) {
                const d = new Date(data.createdAt.seconds * 1000);
                dateDisplay = d.toLocaleDateString('en-GB');
            }

            html += `
            <a href="view-collection.html?id=${doc.id}" class="group block cursor-pointer animate-[fadeIn_0.5s_ease-out]">
                <div class="relative overflow-hidden aspect-[16/9] w-full bg-gray-100 dark:bg-gray-800 border-t border-l border-r border-gray-200 dark:border-white/10 group-hover:border-gold dark:group-hover:border-gold transition-colors duration-500">
                    <img src="${cover}" class="w-full h-full object-cover transition-transform duration-[1.5s] ease-in-out group-hover:scale-[1.02]" loading="lazy">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500"></div>
                </div>
                
                <div class="border-b border-l border-r border-gray-200 dark:border-white/10 p-6 md:p-8 bg-white dark:bg-white/5 group-hover:border-gold dark:group-hover:border-gold transition-colors duration-500 relative">
                    <div class="flex justify-between items-start">
                        <div class="flex-1 pr-4">
                            <h3 class="font-serif text-3xl italic text-darkText dark:text-lightText group-hover:text-gold transition-colors duration-300 leading-tight mb-2">
                                ${data.title}
                            </h3>
                            <p class="text-[10px] text-gray-400 uppercase tracking-[0.1em]">
                                ${dateDisplay}
                            </p>
                        </div>
                        <div class="text-right">
                            <span class="block text-2xl text-gray-300 dark:text-gray-600 group-hover:text-gold transition-colors duration-300">
                                <i class="fas fa-long-arrow-alt-right group-hover:translate-x-1 transition-transform"></i>
                            </span>
                        </div>
                    </div>
                    <div class="w-8 h-[1px] bg-gray-200 dark:bg-white/20 mt-6 group-hover:w-full group-hover:bg-gold/50 transition-all duration-700"></div>
                    <div class="mt-3 text-right">
                        <p class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] group-hover:text-gold transition-colors">
                            ${data.photoCount || 0} <span data-i18n="photos_count">Photos</span>
                        </p>
                    </div>
                </div>
            </a>`;
        });
        
        container.innerHTML = html;
        if(typeof refreshLanguage === 'function') refreshLanguage();

    } catch (e) { console.error("Lỗi tải album:", e); }
}

// ==============================================
// 4. LOGIC TRANG VIEW COLLECTION (Chi tiết & Ảnh)
// ==============================================

async function loadAlbumDataAndPhotos(albumId) {
    const container = document.getElementById('photo-container');
    
    try {
        // 1. Lấy thông tin Album trước (để làm fallback cho Location/Date của ảnh)
        const albumDoc = await db.collection('albums').doc(albumId).get();
        let albumData = {};
        
        if (albumDoc.exists) {
            albumData = albumDoc.data();
            
            // Cập nhật Header
            const titleEl = document.getElementById('album-title');
            const descEl = document.getElementById('album-desc');
            if(titleEl) titleEl.innerText = albumData.title;
            if(descEl) descEl.innerText = albumData.description || "";
            document.title = `${albumData.title} | My First Lens`;
        } else {
            container.innerHTML = '<p class="text-center text-red-500">Album không tồn tại.</p>';
            return;
        }

        // 2. Lấy danh sách Ảnh
        const snapshot = await db.collection('photos')
            .where('albumId', '==', albumId)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-center text-gray-400 italic col-span-full py-10">Album này chưa có ảnh nào.</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Xử lý thumbnail: Cắt vuông (crop fill) để grid 3 cột đều tăm tắp
            const thumb = data.url.replace('/upload/', '/upload/w_600,h_600,c_fill,q_auto/');
            
            // --- XỬ LÝ METADATA THÔNG MINH ---
            // Ưu tiên thông tin riêng của ảnh (caption/location), nếu không có thì lấy của Album
            
            // 1. Location/Caption
            // Trong admin mới, field 'location' của ảnh được dùng lưu caption/mô tả riêng
            // Nếu ảnh không có mô tả riêng, ta dùng địa điểm của Album làm location mặc định
            const displayLocation = data.caption || data.location || albumData.location || 'Unknown';
            const safeLocation = displayLocation.replace(/'/g, "\\'"); // Escape dấu nháy đơn

            // 2. Date Taken
            // Ưu tiên ngày chụp của ảnh -> Ngày chụp của Album -> Ngày upload
            let dateTaken = "N/A";
            if (data.takenDate) {
                dateTaken = new Date(data.takenDate).toLocaleDateString('en-GB');
            } else if (albumData.dateTaken) {
                dateTaken = new Date(albumData.dateTaken).toLocaleDateString('en-GB');
            } else if (data.createdAt) {
                dateTaken = new Date(data.createdAt.seconds * 1000).toLocaleDateString('en-GB');
            }

            // 3. EXIF Data (Encode để truyền vào HTML)
            const exifJSON = data.exif ? encodeURIComponent(JSON.stringify(data.exif)) : '';

            // Render Grid Item (1 hàng 3 ảnh -> class grid-cols-3 đã chỉnh ở HTML)
            html += `
            <div class="group relative aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-zoom-in rounded-sm" 
                 onclick="openLightbox('${data.url}', '${doc.id}', '${safeLocation}', '${dateTaken}', '${exifJSON}')">
                
                <img src="${thumb}" class="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-105" loading="lazy">
                
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>
                
                <div class="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-3 text-white drop-shadow-md transform translate-y-2 group-hover:translate-y-0">
                     <span class="text-xs font-bold flex items-center gap-1">
                        <i class="fas fa-heart"></i> ${data.likes || 0}
                     </span>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;

    } catch (e) { console.error(e); }
}

// ==============================================
// 5. LIGHTBOX & TƯƠNG TÁC
// ==============================================

window.openLightbox = function(url, photoId, location, date, exifString) {
    currentPhotoId = photoId;
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightbox-img');
    
    // UI Elements
    const locEl = document.getElementById('meta-location');
    const dateEl = document.getElementById('meta-date');
    const exifContainer = document.getElementById('meta-exif');

    if (modal && img) {
        // 1. Load ảnh
        img.src = url;

        // 2. Điền Metadata
        if(locEl) locEl.innerText = (location && location !== 'undefined') ? location : 'Vietnam';
        if(dateEl) dateEl.innerText = date || '...';

        // 3. Điền EXIF
        if (exifString && exifContainer) {
            try {
                const exif = JSON.parse(decodeURIComponent(exifString));
                // Kiểm tra xem có dữ liệu camera hợp lệ không
                if (exif.camera && exif.camera !== 'Unknown Camera') {
                    document.getElementById('exif-camera').innerText = exif.camera;
                    document.getElementById('exif-aperture').innerText = exif.aperture || '--';
                    document.getElementById('exif-shutter').innerText = exif.shutter || '--';
                    document.getElementById('exif-iso').innerText = exif.iso || '--';
                    exifContainer.classList.remove('hidden');
                } else {
                    exifContainer.classList.add('hidden');
                }
            } catch (e) {
                exifContainer.classList.add('hidden');
            }
        } else if (exifContainer) {
            exifContainer.classList.add('hidden');
        }

        // 4. Hiển thị Modal
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // 5. Khởi động các listener Realtime
        checkLikeStatus(photoId);
        
        // Listener Likes
        if(unsubscribeLikes) unsubscribeLikes();
        unsubscribeLikes = db.collection('photos').doc(photoId)
            .onSnapshot((doc) => {
                if(doc.exists) {
                    const d = doc.data();
                    const likeCountEl = document.getElementById('like-count');
                    if(likeCountEl) likeCountEl.innerText = d.likes || 0;
                }
            });

        // Listener Comments
        loadRealtimeComments(photoId);
    }
};

window.closeLightbox = function() {
    const modal = document.getElementById('lightboxModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        
        // Hủy listener để tránh leak memory
        if(unsubscribeComments) unsubscribeComments();
        if(unsubscribeLikes) unsubscribeLikes();
        
        currentPhotoId = null;
        setTimeout(() => document.getElementById('lightbox-img').src = '', 200);
    }
};

// --- LOGIC COMMENT ---
function loadRealtimeComments(photoId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '<div class="text-center mt-10"><i class="fas fa-circle-notch fa-spin text-gray-400"></i></div>';

    if(unsubscribeComments) unsubscribeComments();

    unsubscribeComments = db.collection('photos').doc(photoId).collection('comments')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            if(snapshot.empty) {
                list.innerHTML = '<p class="text-center text-gray-400 text-xs italic mt-10">Chưa có bình luận nào.<br>Hãy là người đầu tiên!</p>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const c = doc.data();
                const time = c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleString('vi-VN') : 'Vừa xong';
                const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'Anonymous')}&background=random&size=32`;

                html += `
                <div class="flex gap-3 mb-4 animate-[fadeIn_0.3s_ease-out]">
                    <img src="${avatar}" class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0">
                    <div>
                        <div class="bg-gray-100 dark:bg-white/5 px-3 py-2 rounded-2xl rounded-tl-none">
                            <p class="text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">${c.name || 'Ẩn danh'}</p>
                            <p class="text-sm text-darkText dark:text-lightText leading-tight">${c.content}</p>
                        </div>
                        <p class="text-[9px] text-gray-400 mt-1 ml-1">${time}</p>
                    </div>
                </div>`;
            });
            list.innerHTML = html;
        });
}

window.postComment = async function() {
    if (!currentPhotoId) return;
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    
    if (content) {
        const guestName = localStorage.getItem('guest_name') || 'Khách tham quan';
        try {
            await db.collection('photos').doc(currentPhotoId).collection('comments').add({
                content: content,
                name: guestName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            input.value = ''; 
        } catch (e) { alert("Lỗi: " + e.message); }
    }
};

// --- LOGIC LIKE ---
function checkLikeStatus(photoId) {
    const likedPhotos = JSON.parse(localStorage.getItem('liked_photos') || '[]');
    const heartIcon = document.getElementById('icon-heart');
    if(!heartIcon) return;

    if (likedPhotos.includes(photoId)) {
        heartIcon.classList.remove('far');
        heartIcon.classList.add('fas', 'text-red-500');
    } else {
        heartIcon.classList.add('far');
        heartIcon.classList.remove('fas', 'text-red-500');
    }
}

window.toggleLike = async function() {
    if (!currentPhotoId) return;
    
    const likedPhotos = JSON.parse(localStorage.getItem('liked_photos') || '[]');
    const isLiked = likedPhotos.includes(currentPhotoId);
    const heartIcon = document.getElementById('icon-heart');
    const photoRef = db.collection('photos').doc(currentPhotoId);

    // Optimistic UI update
    if (!isLiked) {
        if(heartIcon) {
            heartIcon.classList.remove('far');
            heartIcon.classList.add('fas', 'text-red-500', 'scale-125');
            setTimeout(() => heartIcon.classList.remove('scale-125'), 200);
        }
        likedPhotos.push(currentPhotoId);
        await photoRef.update({ likes: firebase.firestore.FieldValue.increment(1) });
    } else {
        if(heartIcon) {
            heartIcon.classList.add('far');
            heartIcon.classList.remove('fas', 'text-red-500');
        }
        const index = likedPhotos.indexOf(currentPhotoId);
        if (index > -1) likedPhotos.splice(index, 1);
        await photoRef.update({ likes: firebase.firestore.FieldValue.increment(-1) });
    }
    localStorage.setItem('liked_photos', JSON.stringify(likedPhotos));
};

// --- HELPER: SET TÊN & NGÔN NGỮ ---
if(!localStorage.getItem('guest_name')) {
    const names = ['Người yêu cái đẹp', 'Khách lạ', 'Photographer', 'Fan cứng'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    localStorage.setItem('guest_name', randomName);
}

function refreshLanguage() {
    if (typeof setLanguage === 'function') {
        const currentLang = localStorage.getItem('lang') || 'vi';
        setLanguage(currentLang);
    }
}