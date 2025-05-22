/**
 * @name SpotifyOverlay
 * @version 1.6.0
 * @author Honzajus
 * @description Spotify overlay
 * @source https://github.com/honzajjekral
 * @authorLink https://www.instagram.com/honzajus/
 * @invite https://discord.gg/KsrpvwUq
 */




module.exports = class SpotifyOverlay {
  start() {
    this.injectStyle();
    this.createOverlay();
    this.canvas = document.createElement("canvas");
    this.canvas.id = "spotify-color-canvas";
    this.canvas.style.display = "none";
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.currentSong = null;
    this.isAnimating = false;
    this.interval = setInterval(() => this.update(), 1000);
  }

  stop() {
    clearInterval(this.interval);
    document.getElementById("spotify-card")?.remove();
    document.getElementById("spotify-overlay-style")?.remove();
    document.getElementById("spotify-color-canvas")?.remove();
  }

  injectStyle() {
    if (document.getElementById("spotify-overlay-style")) return;
    const style = document.createElement("style");
    style.id = "spotify-overlay-style";
    style.textContent = `
      #spotify-card {
        position: fixed;
        bottom: 45px;
        right: 30px;
        max-width: 250px;
        width: 250px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        background: black;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        z-index: 9999;
        color: white;
        font-family: 'Poppins', sans-serif;
        overflow: hidden;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.5s ease, transform 0.5s ease;
        cursor: pointer;
        will-change: transform, opacity;
      }

      #spotify-card.show {
        opacity: 1;
        transform: translateY(0);
      }

      #spotify-card.animating {
        pointer-events: none;
      }

      #spotify-card:hover {
        transform: translateY(-5px) translateX(5px) rotate(3deg);
        transition: transform 0.3s ease;
      }

      #spotify-card .background-blur {
        position: absolute;
        inset: 0;
        z-index: -1;
        filter: blur(18px);
        opacity: 0.7;
        background-size: cover;
        background-position: center;
        transition: background 1s ease;
        border-radius: 12px;
      }

      #spotify-card .card-top {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #spotify-album-art {
        width: 50px;
        height: 50px;
        border-radius: 6px;
        object-fit: cover;
        flex-shrink: 0;
        user-select: none;
      }

      #spotify-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      #spotify-title {
        font-weight: 600;
        font-size: 14px;
        overflow-wrap: break-word;
      }

      #spotify-artist {
        font-size: 11px;
        font-family: monospace;
        color: #ccc;
        margin-top: 3px;
      }

      .progress-container {
        position: relative;
        margin-top: 10px;
        height: 6px;
        background-color: #444;
        border-radius: 3px;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background-color: #1DB954;
        width: 0%;
        transition: width 0.5s linear;
      }

      #spotify-time {
        font-size: 11px;
        color: #ccc;
        margin-top: 5px;
        text-align: right;
        font-family: monospace;
        position: relative;
        display: inline-block;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }

      #spotify-time.animating {
        transform: translateY(-4px);
        opacity: 0.4;
      }
    `;
    document.head.appendChild(style);
  }

  createOverlay() {
    if (document.getElementById("spotify-card")) return;

    const overlay = document.createElement("div");
    overlay.id = "spotify-card";
    overlay.innerHTML = `
      <div class="background-blur" id="spotify-background-blur"></div>
      <div class="card-top">
        <img id="spotify-album-art" src="" alt="Album Art" crossorigin="anonymous" />
        <div id="spotify-info">
          <div id="spotify-title">Song Title</div>
          <div id="spotify-artist">Artist</div>
        </div>
      </div>
      <div class="progress-container">
        <div class="progress-bar" id="spotify-progress"></div>
      </div>
      <div id="spotify-time">0:00 / 0:00</div>
    `;
    document.body.appendChild(overlay);
  }

  async update() {
    const SpotifyStore = BdApi.findModuleByProps("getActiveSocketAndDevice", "getActivity");
    if (!SpotifyStore) return;

    const activity = SpotifyStore.getActivity(false);
    const overlay = document.getElementById("spotify-card");
    const songEl = document.getElementById("spotify-title");
    const artistEl = document.getElementById("spotify-artist");
    const coverEl = document.getElementById("spotify-album-art");
    const progressBar = document.getElementById("spotify-progress");
    const background = document.getElementById("spotify-background-blur");
    const timeEl = document.getElementById("spotify-time");

    if (!activity || activity.name !== "Spotify") {
      overlay.classList.remove("show");
      return;
    }

    if (!this.currentSong || this.currentSong !== activity.details) {
      if (this.isAnimating) return; // prevent overlap animation
      this.isAnimating = true;

      overlay.classList.remove("show");
      await this.wait(500);

      this.currentSong = activity.details;

      songEl.textContent = activity.details || "Unknown Song";
      artistEl.textContent = activity.state || "Unknown Artist";

      let imageHash = activity.assets?.largeImage?.split(":")[1];
      let imageUrl = imageHash ? `https://i.scdn.co/image/${imageHash}` : "";

      if (!imageUrl) {
        imageUrl = await this.fetchExternalCover(songEl.textContent, artistEl.textContent);
      }

      if (imageUrl) {
        coverEl.src = imageUrl;
        coverEl.onload = () => this.updateBackgroundFromImage(coverEl, background);
      }

      overlay.classList.add("show");
      this.isAnimating = false;
    } else {
      overlay.classList.add("show");
    }

    const start = new Date(activity.timestamps.start).getTime();
    const end = new Date(activity.timestamps.end).getTime();
    const now = Date.now();
    const duration = end - start;
    const elapsed = now - start;
    const progress = Math.min((elapsed / duration) * 100, 100);
    progressBar.style.width = `${progress}%`;
    timeEl.textContent = `${this.formatTime(elapsed)} / ${this.formatTime(duration)}`;
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  formatTime(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const remaining = String(sec % 60).padStart(2, "0");
    return `${min}:${remaining}`;
  }

  updateBackgroundFromImage(img, background) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const w = canvas.width;
    const h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;

    const points = [
      { x: Math.floor(w * 0.25), y: Math.floor(h * 0.25) },
      { x: Math.floor(w * 0.75), y: Math.floor(h * 0.25) },
      { x: Math.floor(w * 0.5),  y: Math.floor(h * 0.5) },
      { x: Math.floor(w * 0.25), y: Math.floor(h * 0.75) },
      { x: Math.floor(w * 0.75), y: Math.floor(h * 0.75) }
    ];

    const colors = points.map(p => {
      const idx = (p.y * w + p.x) * 4;
      return `rgb(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]})`;
    });

    background.style.background = `linear-gradient(135deg, ${colors.join(", ")})`;
  }

  async fetchExternalCover(song, artist) {
    try {
      const query = encodeURIComponent(`${song} ${artist}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${query}&limit=1&media=music`);
      const data = await res.json();
      return data.results?.[0]?.artworkUrl100?.replace("100x100", "512x512") || "";
    } catch {
      return "";
    }
  }
};
