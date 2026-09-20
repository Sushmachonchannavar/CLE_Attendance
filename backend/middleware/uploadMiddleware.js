const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage destination and filename
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = process.env.UPLOAD_DIR
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.resolve(__dirname, '../uploads/od-documents/');
        // Ensure destination folder exists
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'od-' + uniqueSuffix + ext);
    }
});

// File filter to restrict uploads to PDF, JPG, JPEG, and PNG
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    const isMimeValid = allowedMimeTypes.includes(file.mimetype);
    const isExtValid = allowedExtensions.includes(ext);

    if (!isMimeValid || !isExtValid) {
        return cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'), false);
    }

    cb(null, true);
};

// Initialize multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB limit
    }
});

const singleUpload = upload.single('document');

// Wrapper middleware to gracefully handle Multer/Validation errors and return JSON
const uploadMiddleware = (req, res, next) => {
    singleUpload(req, res, (err) => {
        if (err) {
            console.error('File upload error:', err.message);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File size too large. Maximum limit is 100 MB.' });
                }
                return res.status(400).json({ error: `File upload helper error: ${err.message}` });
            }
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

module.exports = uploadMiddleware;
