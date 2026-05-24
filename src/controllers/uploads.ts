import { Request, Response } from 'express';
import multer from 'multer';
import { uploadImage, deleteImage } from '../lib/cloudinary';

// Set up in-memory storage for Multer
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
}).single('image');

export async function uploadSingleImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image file' });
    }

    // Call Cloudinary SDK upload
    const result = await uploadImage(req.file.buffer, 'cphones/products');

    res.status(200).json({
      message: 'Image uploaded successfully',
      secure_url: result.secure_url,
      public_id: result.public_id
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Image upload failed' });
  }
}

export async function deleteSingleImage(req: Request, res: Response) {
  try {
    const { public_id } = req.body;

    if (!public_id) {
      return res.status(400).json({ error: 'public_id is required' });
    }

    await deleteImage(public_id);

    res.status(200).json({ message: 'Image deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Image deletion failed' });
  }
}
