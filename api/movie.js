export default async function handler(req, res) {
  try {
    const page = req.query.page || 1;
    
    // Mengambil data film dari API publik yang stabil dan bebas blokir Cloudflare
    const response = await fetch(`https://movie-api-ed63.onrender.com/api/get`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Gagal memuat film' });
    }

    const json = await response.json();
    const data = [];

    // Memetakan data film terbaru dari sumber
    if (json && json.latest) {
      json.latest.forEach(movie => {
        data.push({
          title: movie.type || 'Film',
          poster: movie.name || '',
          slug: movie.id || '',
          episode: movie.img || 'HD',
          type: 'Movie'
        });
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
