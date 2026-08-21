let globalSettings = {
  brandTitle: 'RZSTREAM',
  pageTitle: 'RZSTREAM - Streaming Donghua Sub Indo'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body.brandTitle) globalSettings.brandTitle = body.brandTitle;
      if (body.pageTitle) globalSettings.pageTitle = body.pageTitle;
      return res.status(200).json({ success: true, settings: globalSettings });
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }
  }

  return res.status(200).json({ success: true, settings: globalSettings });
}
