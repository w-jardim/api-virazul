const asyncHandler = require('../../utils/async-handler');
const service = require('./reports.service');

const operational = asyncHandler(async (req, res) => {
  const data = await service.getOperationalReport(req.user.id, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const financial = asyncHandler(async (req, res) => {
  const data = await service.getFinancialReport(req.user.id, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const exportPdf = asyncHandler(async (req, res) => {
  const { html, filename } = req.body || {};
  if (!html) {
    return res.status(400).json({ data: null, meta: null, errors: ['html is required'] });
  }

  const puppeteer = require('puppeteer');

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename || 'report.pdf'}"`);
    res.send(buffer);
  } finally {
    try { await browser.close() } catch (e) {}
  }
});

module.exports = {
  operational,
  financial,
  exportPdf,
};
