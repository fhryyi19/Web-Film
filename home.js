/* ========= CONFIG (ganti API_KEY jika perlu) ========= */
const API_KEY = "97104b5a13cd5adcf122a8368ea334a0"; // <-- ganti jika perlu
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

/* ========= DOM ========= */
const moviesList = document.getElementById("moviesList");
const genreButtons = document.getElementById("genreButtons");
const topPicks = document.getElementById("topPicks");
const searchInput = document.getElementById("searchInput");
const suggestionsBox = document.getElementById("suggestions");
const resetBtn = document.getElementById("resetBtn");
const minRating = document.getElementById("minRating");
const minRatingValue = document.getElementById("minRatingValue");
const sortBy = document.getElementById("sortBy");
const loadMoreBtn = document.getElementById("loadMore");
const modal = document.getElementById("modal");
const modalInner = document.getElementById("modalInner");
const modalClose = document.getElementById("modalClose");
const favoritesBtn = document.getElementById("favoritesBtn");
const toast = document.getElementById("toast");
document.getElementById("year").innerText = new Date().getFullYear();

/* ========= STATE ========= */
let genres = [];
let movies = [];
let page = 1;
let totalPages = 1;
let query = "";
let selectedGenreId = null;
let favorites = new Set(JSON.parse(localStorage.getItem("favMovies")||"[]"));

/* ========= UTIL ========= */
function showToast(msg, timeout=2200){
  toast.innerText = msg;
  toast.classList.remove("hidden");
  setTimeout(()=>toast.classList.add("hidden"), timeout);
}
function debounce(fn, wait=300){
  let t;
  return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); };
}

/* ========= FETCH HELPERS ========= */
async function fetchGenres(){
  const res = await fetch(`${BASE}/genre/movie/list?api_key=${API_KEY}&language=id-ID`);
  const data = await res.json();
  genres = data.genres || [];
  renderGenres();
}
async function fetchMovies({page=1,append=false} = {}){
  // If there's a query use search endpoint
  const q = query.trim();
  const url = q ? `${BASE}/search/movie?api_key=${API_KEY}&language=id-ID&query=${encodeURIComponent(q)}&page=${page}` : `${BASE}/movie/popular?api_key=${API_KEY}&language=id-ID&page=${page}`;
  const res = await fetch(url);
  const data = await res.json();
  totalPages = data.total_pages || 1;
  if(append) movies = movies.concat(data.results || []);
  else movies = data.results || [];
  renderMovies();
  renderTopPicks();
}

/* ========= RENDER ========= */
function renderGenres(){
  genreButtons.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.textContent = "Semua";
  allBtn.className = selectedGenreId ? "" : "active";
  allBtn.onclick = ()=>{ selectedGenreId = null; renderGenres(); renderMovies(); };
  genreButtons.appendChild(allBtn);

  genres.forEach(g=>{
    const b = document.createElement("button");
    b.textContent = g.name;
    b.dataset.id = g.id;
    if(selectedGenreId === g.id) b.classList.add("active");
    b.onclick = ()=>{
      selectedGenreId = selectedGenreId === g.id ? null : g.id;
      renderGenres();
      renderMovies();
    };
    genreButtons.appendChild(b);
  });
}

function createSkeleton(count=8){
  return Array.from({length:count}).map(_=>`
    <div class="movie skeleton" aria-hidden="true">
      <div class="poster" style="height:280px;border-radius:10px"></div>
      <div class="body" style="padding:12px">
        <div style="height:14px;width:60%;border-radius:6px;background:#fff"></div>
        <div style="height:12px;width:40%;margin-top:8px;border-radius:6px;background:#fff"></div>
      </div>
    </div>
  `).join("");
}

function renderMovies(){
  // Filter client-side by rating & genre & sort
  let list = movies.slice();

  // rating
  const minR = Number(minRating.value);
  if(minR > 0) list = list.filter(m => (m.vote_average || 0) >= minR);

  // genre filter (TMDB uses genre_ids)
  if(selectedGenreId) list = list.filter(m => (m.genre_ids || []).includes(selectedGenreId));

  // sort
  if(sortBy.value === "rating") list.sort((a,b)=> (b.vote_average||0)-(a.vote_average||0));
  if(sortBy.value === "year") list.sort((a,b)=> (b.release_date||"0") < (a.release_date||"0") ? 1 : -1);

  // render
  if(!list.length){
    moviesList.innerHTML = `<div class="card"><p style="color:var(--muted)">Tidak ada hasil. Coba ubah filter atau kata kunci.</p></div>`;
    return;
  }

  moviesList.innerHTML = list.map(m=>{
    const poster = m.poster_path ? `${IMG+m.poster_path}` : `https://via.placeholder.com/500x750?text=No+Image`;
    const fav = favorites.has(m.id) ? "❤️" : "🤍";
    const overview = (m.overview || "").slice(0,140);
    return `
      <article class="movie" data-id="${m.id}">
        <img class="poster lazy" data-src="${poster}" alt="${m.title}" />
        <div class="body">
          <div class="title">${m.title}</div>
          <div class="meta">
            <div class="badge">${(m.vote_average||0).toFixed(1)} ★</div>
            <div style="color:var(--muted)">${(m.release_date||"").slice(0,4)}</div>
            <button class="fav-btn" data-id="${m.id}" title="Tambah ke favorit">${fav}</button>
          </div>
          <div class="summary">${overview}</div>
        </div>
      </article>
    `;
  }).join("");

  // lazy load posters
  const imgs = document.querySelectorAll("img.lazy");
  const io = new IntersectionObserver((entries,observer)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        const img = e.target;
        img.src = img.dataset.src;
        img.classList.remove("lazy");
        observer.unobserve(img);
      }
    });
  }, {rootMargin: "200px"});
  imgs.forEach(i=>io.observe(i));

  // attach event listeners to posters/fav
  document.querySelectorAll(".movie").forEach(card=>{
    card.onclick = (ev)=>{
      // avoid clicking favorite button
      if(ev.target.closest(".fav-btn")) return;
      openModal(Number(card.dataset.id));
    };
  });

  document.querySelectorAll(".fav-btn").forEach(btn=>{
    btn.onclick = (e)=>{
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      toggleFavorite(id);
      renderMovies(); // rerender to update heart
      showToast(favorites.has(id) ? "Ditambahkan ke favorit" : "Dihapus dari favorit");
    };
  });
}

function renderTopPicks(){
  const top = [...movies].sort((a,b)=> (b.vote_average||0) - (a.vote_average||0)).slice(0,6);
  topPicks.innerHTML = top.map(t=>`<li>${t.title} — ⭐${(t.vote_average||0).toFixed(1)}</li>`).join("");
}

/* ========= FAVORITES ========= */
function saveFavorites(){
  localStorage.setItem("favMovies", JSON.stringify(Array.from(favorites)));
}
function toggleFavorite(id){
  if(favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFavorites();
}

/* ========= MODAL ========= */
async function openModal(id){
  modal.classList.remove("hidden");
  modalInner.innerHTML = createSkeleton(1);
  try{
    const res = await fetch(`${BASE}/movie/${id}?api_key=${API_KEY}&language=id-ID`);
    const d = await res.json();
    const img = d.poster_path ? IMG+d.poster_path : "";
    modalInner.innerHTML = `
      <img src="${img}" alt="${d.title}" style="width:42%;border-radius:10px;object-fit:cover;margin-right:16px"/>
      <div class="modal-body">
        <h2 style="margin:0 0 6px">${d.title}</h2>
        <div style="color:var(--muted);margin-bottom:8px">${(d.release_date||"").slice(0,4)} • ⭐ ${(d.vote_average||0).toFixed(1)} • ${d.runtime||'-'}m</div>
        <p style="line-height:1.5;color:#334155">${d.overview}</p>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="primary" id="playBtn">Tonton Trailer</button>
          <button class="ghost" id="addFavModal">${favorites.has(d.id)?'Hapus Favorit':'Tambah Favorit'}</button>
        </div>
      </div>
    `;
    document.getElementById("addFavModal").onclick = ()=>{
      toggleFavorite(d.id);
      showToast(favorites.has(d.id) ? "Ditambahkan ke favorit" : "Dihapus dari favorit");
    };
    document.getElementById("playBtn").onclick = async ()=>{
      // Try to fetch trailer
      const rr = await fetch(`${BASE}/movie/${d.id}/videos?api_key=${API_KEY}`);
      const dd = await rr.json();
      const vid = (dd.results||[]).find(x=>x.site==="YouTube");
      if(vid) window.open(`https://youtube.com/watch?v=${vid.key}`, "_blank");
      else showToast("Trailer tidak tersedia");
    };
  }catch(err){
    modalInner.innerHTML = `<div class="card"><p>Error memuat detail.</p></div>`;
  }
}
modalClose.onclick = ()=> modal.classList.add("hidden");
modal.onclick = (e)=>{ if(e.target === modal) modal.classList.add("hidden"); }

/* ========= SEARCH & SUGGEST (debounced) ========= */
async function suggest(q){
  if(!q) return suggestionsBox.classList.add("hidden");
  const res = await fetch(`${BASE}/search/movie?api_key=${API_KEY}&language=id-ID&query=${encodeURIComponent(q)}&page=1`);
  const data = await res.json();
  const items = (data.results||[]).slice(0,6);
  suggestionsBox.innerHTML = items.map(it=>`<div class="item" data-id="${it.id}">${it.title} <span style="color:#94a3b8;font-size:12px">(${(it.release_date||"").slice(0,4)})</span></div>`).join("");
  suggestionsBox.classList.remove("hidden");

  // click suggestion
  suggestionsBox.querySelectorAll(".item").forEach(x=>{
    x.onclick = ()=>{
      searchInput.value = x.innerText;
      suggestionsBox.classList.add("hidden");
      query = x.innerText;
      page = 1;
      fetchMovies({page});
    };
  });
}

const debouncedSuggest = debounce((v)=>{
  if(!v) return suggestionsBox.classList.add("hidden");
  suggest(v);
}, 350);

searchInput.addEventListener("input", (e)=>{
  const v = e.target.value;
  debouncedSuggest(v);
  query = v;
  if(!v) { page = 1; fetchMovies({page}); }
});

/* ========= LOAD MORE / INFINITE ========= */
loadMoreBtn.onclick = async ()=>{
  if(page >= totalPages) { showToast("Tidak ada lagi"); return; }
  page++;
  // show skeleton while loading
  moviesList.insertAdjacentHTML('beforeend', createSkeleton(4));
  await fetchMovies({page, append:true});
};

/* ========= RESET / UI binds ========= */
resetBtn.onclick = ()=> {
  query = "";
  searchInput.value = "";
  minRating.value = 0;
  minRatingValue.innerText = "0";
  sortBy.value = "popular";
  selectedGenreId = null;
  page = 1;
  fetchMovies({page});
  renderGenres();
};
minRating.oninput = ()=> {
  minRatingValue.innerText = minRating.value;
  renderMovies();
};
sortBy.onchange = ()=> renderMovies();

document.addEventListener("click", (e)=>{
  if(e.target.classList.contains("genres")) return;
  if(!e.target.closest(".search-wrap")) suggestionsBox.classList.add("hidden");
});

/* ========= FAVORITES VIEW ========= */
favoritesBtn.onclick = async ()=>{
  // show favorites as local result
  if(!favorites.size){ showToast("Belum ada favorit"); return; }
  moviesList.innerHTML = createSkeleton(6);
  // fetch details for each favorite id in parallel (be mindful of rate)
  const ids = Array.from(favorites);
  const proms = ids.map(id => fetch(`${BASE}/movie/${id}?api_key=${API_KEY}&language=id-ID`).then(r=>r.json()).catch(()=>null));
  const results = await Promise.all(proms);
  movies = results.filter(Boolean);
  renderMovies();
};

/* ========= INIT ========= */
async function init(){
  moviesList.innerHTML = createSkeleton(8);
  await fetchGenres();
  await fetchMovies({page:1});
}
init();
