import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary SDK
const isMock = !process.env.CLOUDINARY_CLOUD_NAME || 
               process.env.CLOUDINARY_CLOUD_NAME === 'cphones_mock' ||
               !process.env.CLOUDINARY_API_KEY ||
               !process.env.CLOUDINARY_API_SECRET;

if (!isMock) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads a file buffer or path to Cloudinary.
 * If credentials are not configured, falls back to elegant electronic placeholder image URLs.
 */
export async function uploadImage(fileBuffer: Buffer | string, folder: string = 'cphones/products'): Promise<{ secure_url: string; public_id: string }> {
  if (isMock) {
    console.log(`[Cloudinary Mock] Uploading file to folder "${folder}"...`);
    
    // Choose beautiful curated electronic photos as mocks depending on what the upload is for
    const mockImages = [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop', // phone
      'https://images.unsplash.com/photo-1496181130204-7552cc14ac42?q=80&w=600&auto=format&fit=crop', // laptop
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600&auto=format&fit=crop'  // headphones/acc
    ];
    
    // Select one randomly or default
    const secure_url = mockImages[Math.floor(Math.random() * mockImages.length)];
    const public_id = `mock_image_${Date.now()}`;
    
    return { secure_url, public_id };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Upload failed'));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id
        });
      }
    );

    if (typeof fileBuffer === 'string') {
      // It is a file path
      cloudinary.uploader.upload(fileBuffer, { folder }, (error, result) => {
        if (error || !result) return reject(error || new Error('Upload failed'));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id
        });
      });
    } else {
      uploadStream.end(fileBuffer);
    }
  });
}

/**
 * Deletes an image from Cloudinary by its public ID.
 */
export async function deleteImage(publicId: string): Promise<any> {
  if (isMock || publicId.startsWith('mock_')) {
    console.log(`[Cloudinary Mock] Deleting image with ID: ${publicId}`);
    return { result: 'ok' };
  }
  return cloudinary.uploader.destroy(publicId);
}

export default cloudinary;
