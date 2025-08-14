const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'data', 'applications.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_FILE));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(fileUpload());
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());

app.set('view engine', 'ejs');

// Ensure JSON file exists
fs.ensureFileSync(DATA_FILE);
if (!fs.readFileSync(DATA_FILE).toString()) {
    fs.writeFileSync(DATA_FILE, '[]');
}

// Routes
app.get('/', (req, res) => res.render('index', { messages: { error: req.flash('error'), success: req.flash('success') } }));
app.get('/about', (req, res) => res.render('about'));
app.get('/apply', (req, res) => res.render('apply', { messages: { error: req.flash('error'), success: req.flash('success') } }));

// Apply form submission
app.post('/apply', (req, res) => {
    const { name, email, phone, whatsapp, education, experience } = req.body;
    const resumeFile = req.files ? req.files.resume : null;

    if (!name || !email || !phone || !whatsapp || !education) {
        req.flash('error', 'All fields except Resume/Experience are required.');
        return res.redirect('/apply');
    }

    if (!resumeFile && !experience) {
        req.flash('error', 'Please upload a resume or enter your experience.');
        return res.redirect('/apply');
    }

    let applications = JSON.parse(fs.readFileSync(DATA_FILE));

    const duplicate = applications.find(a =>
        a.email.toLowerCase() === email.toLowerCase() ||
        a.phone === phone ||
        a.whatsapp === whatsapp
    );
    if (duplicate) {
        req.flash('error', 'This email, phone, or WhatsApp number is already registered.');
        return res.redirect('/apply');
    }

    let resumePath = null;
    if (resumeFile) {
        const ext = path.extname(resumeFile.name);
        const filename = `resume_${Date.now()}${ext}`;
        const uploadPath = path.join(__dirname, 'public', 'uploads', filename);
        resumeFile.mv(uploadPath);
        resumePath = `/uploads/${filename}`;
    }

    const newEntry = {
        id: applications.length ? applications[applications.length - 1].id + 1 : 1,
        name, email, phone, whatsapp, education,
        experience: experience || null,
        resume: resumePath
    };
    applications.push(newEntry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(applications, null, 2));

    req.flash('success', 'We have received your application!');
    res.redirect('/apply');
});

// Admin login
app.get('/admin/login', (req, res) => res.render('admin-login', { error: null }));

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === config.adminUsername && password === config.adminPassword) {
        req.session.isAdmin = true;
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin-login', { error: 'Invalid credentials.' });
    }
});

// Admin dashboard
app.get('/admin/dashboard', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin/login');
    const applications = JSON.parse(fs.readFileSync(DATA_FILE));
    res.render('admin-dashboard', { applications });
});

// Delete applicant
app.get('/admin/delete/:id', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin/login');
    let applications = JSON.parse(fs.readFileSync(DATA_FILE));
    applications = applications.filter(a => a.id != req.params.id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(applications, null, 2));
    res.redirect('/admin/dashboard');
});

// Logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
