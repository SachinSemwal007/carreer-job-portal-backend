// uploadMiddleware.js 
const multer = require('multer'); 
const path = require('path'); 
 
// Set up storage engine 
const storage = multer.diskStorage({ 
  destination: (req, file, cb) => { 
    cb(null, 'uploads/'); // Directory to store temporary files 
  }, 
  filename: (req, file, cb) => { 
    cb(null, `${Date.now()}_${file.originalname}`); 
  }, 
}); 
 
// File filter to accept only image files 
const fileFilter = (req, file, cb) => { 
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg','image/webp','application/pdf']; 
  if (allowedTypes.includes(file.mimetype)) { 
    cb(null, true); 
  } else { 
    cb(new Error('Only JPEG, PNG, and JPG images are allowed.')); 
  } 
}; 
 
const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter, 
  limits: { 
    fileSize: 5 * 1024 * 1024, // Maximum file size: 5MB 
  }, 
}); 
 
module.exports = upload; 
