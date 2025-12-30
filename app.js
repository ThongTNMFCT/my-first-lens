// app.js - Cinematic Edition
// Xử lý logic hiển thị ảnh, album và tương tác người dùng

// 1. KIỂM TRA CẤU HÌNH
if (typeof CONFIG === 'undefined') { console.error("Thiếu config.js!"); }
if (!firebase.apps.length) firebase.initializeApp(CONFIG.firebase);

const db = firebase.firestore();

// Biến toàn cục
let currentPhotoId = null;
let unsubscribeComments = null;
let unsubscribeLikes = null;

// 2. ROUTING & INIT
document.addEventListener('DOMContentLoaded', () => {
    // Init Animations (Nếu có GSAP)
    if (typeof gsap !== 'undefined') {
        initAnimations();
    }

    // Trang Danh sách Album
    if (document.getElementById('album-list-container')) {
        loadAlbums();
    }
    
    // Trang Chi tiết Album
    if (document.getElementById('photo-container')) {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (id) {
            loadAlbumDataAndPhotos(id);
        } else {
            // Redirect về trang chủ nếu không có ID
            window.location.href = 'collection.html';
        }
    }
});

// Animation Init Helper
function initAnimations() {
    gsap.registerPlugin(ScrollTrigger);
    
    // Reveal Text Animation
    const reveals = document.querySelectorAll('.reveal-text');
    reveals.forEach(el => {
        gsap.fromTo(el, 
            { y: 50, opacity: 0 },
            { 
                y: 0, opacity: 1, duration: 1.2, ease: "power3.out",
                scrollTrigger: { trigger: el, start: "top 85%" }
            }
        );
    });
}

// ==============================================
// 3. LOGIC TRANG COLLECTION (Danh sách Album)
// ==============================================
async function loadAlbums() {
    const container = document.getElementById('album-list-container');
    const loading = document.getElementById('loading-state');
    
    try {
        const snapshot = await db.collection('albums').orderBy('createdAt', 'desc').get();
        
        if (loading) loading.style.display = 'none';

        if (snapshot.empty) { 
            container.innerHTML = `<div class="col-span-full text-center py-20"><p class="text-white/40 font-serif italic text-2xl">Chưa có bộ sưu tập nào.</p></div>`; 
            return; 
        }

        let html = '';
        snapshot.forEach((doc, index) => {
            const data = doc.data();
            // Ảnh bìa chất lượng cao
            const cover = data.coverUrl 
                ? data.coverUrl.replace('/upload/', '/upload/w_1200,f_auto,q_auto/') 
                : 'https://via.placeholder.com/1000x560?text=No+Cover';
            
            const year = data.dateTaken ? new Date(data.dateTaken).getFullYear() : new Date().getFullYear();
            const count = data.photoCount || 0;

            // Layout so le: Chẵn lẻ khác nhau
            const isEven = index % 2 === 0;
            
            html += `
            <a href="view-collection.html?id=${doc.id}" class="group block relative w-full mb-32 reveal-text">
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div class="lg:col-span-8 ${isEven ? 'lg:order-1' : 'lg:order-2'} relative overflow-hidden">
                        <div class="aspect-[16/10] overflow-hidden bg-white/5">
                            <img src="${cover}" class="w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105" loading="lazy">
                        </div>
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500"></div>
                    </div>

                    <div class="lg:col-span-4 ${isEven ? 'lg:order-2 text-left' : 'lg:order-1 lg:text-right'} space-y-4 z-10">
                        <div class="flex items-center gap-4 ${isEven ? '' : 'lg:justify-end'} text-gold/80 text-xs font-bold uppercase tracking-[0.2em]">
                            <span>${year}</span>
                            <span class="w-8 h-[1px] bg-gold/50"></span>
                            <span>${count} SHOTS</span>
                        </div>
                        <h2 class="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-tight group-hover:text-gold transition-colors duration-300">
                            ${data.title}
                        </h2>
                        <p class="text-white/60 text-sm font-light line-clamp-2 max-w-md ${isEven ? '' : 'ml-auto'}">
                            ${data.description || 'Một bộ sưu tập những khoảnh khắc được lưu giữ.'}
                        </p>
                        <div class="pt-4">
                            <span class="inline-block text-white text-xs tracking-[0.3em] border-b border-white/30 pb-1 group-hover:border-gold group-hover:text-gold transition-all">XEM ALBUM</span>
                        </div>
                    </div>
                </div>
            </a>`;
        });
        
        container.innerHTML = html;
        // Re-init animation cho các element mới
        if (typeof gsap !== 'undefined') initAnimations();

    } catch (e) { console.error("Lỗi tải album:", e); }
}

// ==============================================
// 4. LOGIC TRANG VIEW COLLECTION (Masonry Grid)
// ==============================================
async function loadAlbumDataAndPhotos(albumId) {
    const container = document.getElementById('photo-container');
    
    try {
        const albumDoc = await db.collection('albums').doc(albumId).get();
        let albumData = {};
        
        if (albumDoc.exists) {
            albumData = albumDoc.data();
            
            // Update Header Info
            document.getElementById('album-title').innerText = albumData.title;
            document.getElementById('album-desc').innerText = albumData.description || "";
            document.getElementById('meta-loc').innerText = albumData.location || "Vietnam";
            document.getElementById('meta-date').innerText = albumData.dateTaken ? new Date(albumData.dateTaken).getFullYear() : "N/A";
            document.title = `${albumData.title} | My First Lens`;
        }

        const snapshot = await db.collection('photos')
            .where('albumId', '==', albumId)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-center text-white/40 italic col-span-full py-20">Album này chưa có ảnh nào.</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            // Lấy ảnh chất lượng cao hơn cho view detail
            const url = data.url.replace('/upload/', '/upload/q_auto,f_auto/');
            // Thumbnail tối ưu
            const thumb = data.url.replace('/upload/', '/upload/w_800,q_auto,f_auto/');
            
            const displayLocation = data.caption || data.location || albumData.location || '';
            const safeLocation = displayLocation.replace(/'/g, "\\'");
            const dateTaken = data.takenDate ? new Date(data.takenDate).toLocaleDateString('en-GB') : "N/A";
            const exifJSON = data.exif ? encodeURIComponent(JSON.stringify(data.exif)) : '';

            // Layout Masonry Item
            html += `
            <div class="mb-8 break-inside-avoid group relative cursor-zoom-in"
                 onclick="openLightbox('${url}', '${doc.id}', '${safeLocation}', '${dateTaken}', '${exifJSON}')">
                
                <div class="overflow-hidden rounded-sm bg-gray-900">
                    <img src="${thumb}" class="w-full h-auto object-cover transition-all duration-700 group-hover:scale-105 group-hover:opacity-80" loading="lazy">
                </div>
                
                <div class="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2 text-white drop-shadow-md">
                     <i class="fas fa-expand text-xs"></i>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;

    } catch (e) { console.error(e); }
}

// ==============================================
// 5. LIGHTBOX & TƯƠNG TÁC (Refined UI)
// ==============================================

window.openLightbox = function(url, photoId, location, date, exifString) {
    currentPhotoId = photoId;
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightbox-img');
    const exifContainer = document.getElementById('meta-exif');

    if (modal && img) {
        img.src = url;
        
        // Reset like status UI
        const heartIcon = document.getElementById('icon-heart');
        if(heartIcon) {
            heartIcon.classList.remove('fas', 'text-red-500');
            heartIcon.classList.add('far');
        }

        // EXIF Handling
        if (exifString && exifContainer) {
            try {
                const exif = JSON.parse(decodeURIComponent(exifString));
                if (exif.camera && exif.camera !== 'Unknown Camera') {
                    document.getElementById('exif-camera').innerText = exif.camera;
                    document.getElementById('exif-settings').innerText = `${exif.aperture || ''} • ${exif.shutter || ''} • ${exif.iso || ''}`;
                    exifContainer.style.display = 'block';
                } else {
                    exifContainer.style.display = 'none';
                }
            } catch (e) { exifContainer.style.display = 'none'; }
        } else if (exifContainer) {
            exifContainer.style.display = 'none';
        }

        // Show Modal
        modal.classList.remove('opacity-0', 'pointer-events-none');
        document.body.style.overflow = 'hidden';

        // Realtime Data
        checkLikeStatus(photoId);
        
        if(unsubscribeLikes) unsubscribeLikes();
        unsubscribeLikes = db.collection('photos').doc(photoId)
            .onSnapshot((doc) => {
                if(doc.exists) {
                    const el = document.getElementById('like-count');
                    if(el) el.innerText = doc.data().likes || 0;
                }
            });

        loadRealtimeComments(photoId);
    }
};

window.closeLightbox = function() {
    const modal = document.getElementById('lightboxModal');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        document.body.style.overflow = 'auto';
        
        if(unsubscribeComments) unsubscribeComments();
        if(unsubscribeLikes) unsubscribeLikes();
        currentPhotoId = null;
        
        setTimeout(() => document.getElementById('lightbox-img').src = '', 300);
    }
};

// --- COMMENT & LIKE LOGIC (Giữ nguyên logic cũ nhưng cập nhật CSS render) ---
function loadRealtimeComments(photoId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '<div class="text-center mt-4"><i class="fas fa-circle-notch fa-spin text-gold"></i></div>';

    if(unsubscribeComments) unsubscribeComments();

    unsubscribeComments = db.collection('photos').doc(photoId).collection('comments')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            if(snapshot.empty) {
                list.innerHTML = '<p class="text-center text-white/30 text-xs italic mt-4">Chưa có bình luận. Hãy là người đầu tiên.</p>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const c = doc.data();
                const time = c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '';
                
                html += `
                <div class="mb-4 animate-fade-in border-b border-white/5 pb-2 last:border-0">
                    <div class="flex justify-between items-baseline mb-1">
                        <span class="text-xs font-bold text-gold uppercase tracking-wider">${c.name || 'Anonymous'}</span>
                        <span class="text-[9px] text-white/30">${time}</span>
                    </div>
                    <p class="text-sm text-white/80 font-light leading-relaxed">${c.content}</p>
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
        const guestName = localStorage.getItem('guest_name') || 'Visitor';
        try {
            await db.collection('photos').doc(currentPhotoId).collection('comments').add({
                content: content,
                name: guestName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            input.value = ''; 
        } catch (e) { alert("Lỗi kết nối"); }
    }
};

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
    const photoRef = db.collection('photos').doc(currentPhotoId);

    if (!isLiked) {
        likedPhotos.push(currentPhotoId);
        await photoRef.update({ likes: firebase.firestore.FieldValue.increment(1) });
    } else {
        const index = likedPhotos.indexOf(currentPhotoId);
        if (index > -1) likedPhotos.splice(index, 1);
        await photoRef.update({ likes: firebase.firestore.FieldValue.increment(-1) });
    }
    localStorage.setItem('liked_photos', JSON.stringify(likedPhotos));
    checkLikeStatus(currentPhotoId);
};