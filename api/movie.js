export default async function handler(req, res) {
  try {
    const page = req.query.page || 1;
    
    // Menggunakan API direktori publik yang stabil untuk daftar film populer & terbaru
    const response = await fetch(`https://vidsrc.xyz/movies/latest/page-${page}.json`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Gagal memuat daftar film' });
    }

    const json = await response.json();
    const data = [];

    // Format data agar sesuai dengan struktur frontend Anda
    if (json && json.result) {
      json.result.forEach(movie => {
        data.push({
          title: movie.title,
          poster: movie.poster || movie.banner || '',
          slug: movie.imdb_id || movie.slug || encodeURIComponent(movie.title),
          episode: movie.quality || 'HD',
          type: 'Movie'
        });
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
