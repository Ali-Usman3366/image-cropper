import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { Upload, Download, Maximize2, Square, Image as ImageIcon, X } from 'lucide-react';
import 'react-image-crop/dist/ReactCrop.css';
import * as faceapi from 'face-api.js';
import { clsx } from 'clsx';

function App() {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [aspect, setAspect] = useState<number>(1);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadFaceDetectionModel();
  }, []);

  useEffect(() => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const newCrop = makeAspectCrop(
        {
          unit: '%',
          width: 90,
          height: 90,
          x: 5,
          y: 5
        },
        aspect,
        width,
        height
      );
      setCrop(centerCrop(newCrop, width, height));
    }
  }, [aspect]);

  const loadFaceDetectionModel = async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    } catch (error) {
      console.error('Error loading face detection model:', error);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
      });
      reader.readAsDataURL(file);
    }
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleCancel = () => {
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const onImageLoad = useCallback(async (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setIsLoading(true);

    try {
      const detections = await faceapi.detectAllFaces(
        e.currentTarget,
        new faceapi.TinyFaceDetectorOptions()
      );

      let cropX = 5;
      let cropY = 5;
      let cropWidth = 90;
      let cropHeight = 90;

      if (detections.length > 0) {
        // Center crop around the first detected face
        const face = detections[0];
        const faceWidth = (face.box.width / width) * 100;
        const faceHeight = (face.box.height / height) * 100;
        
        // Calculate crop dimensions based on aspect ratio
        if (aspect === 1) { // 1:1
          cropWidth = cropHeight = Math.max(faceWidth, faceHeight) * 1.5;
        } else if (aspect === 4/5) { // 4:5
          cropWidth = faceWidth * 1.5;
          cropHeight = cropWidth * (5/4);
        } else if (aspect === 16/9) { // 16:9
          cropHeight = faceHeight * 1.5;
          cropWidth = cropHeight * (16/9);
        }

        // Center the crop around the face
        cropX = ((face.box.x / width) * 100) - ((cropWidth - faceWidth) / 2);
        cropY = ((face.box.y / height) * 100) - ((cropHeight - faceHeight) / 2);

        // Ensure crop stays within image bounds
        cropX = Math.max(0, Math.min(cropX, 100 - cropWidth));
        cropY = Math.max(0, Math.min(cropY, 100 - cropHeight));
      }

      const crop = makeAspectCrop(
        {
          unit: '%',
          x: cropX,
          y: cropY,
          width: cropWidth,
          height: cropHeight,
        },
        aspect,
        width,
        height
      );

      const centeredCrop = centerCrop(crop, width, height);
      setCrop(centeredCrop);
    } catch (error) {
      console.error('Error detecting faces:', error);
      // Fallback to center crop if face detection fails
      const crop = makeAspectCrop(
        {
          unit: '%',
          x: 5,
          y: 5,
          width: 90,
          height: 90,
        },
        aspect,
        width,
        height
      );
      const centeredCrop = centerCrop(crop, width, height);
      setCrop(centeredCrop);
    }

    setIsLoading(false);
  }, [aspect]);

  const downloadCroppedImage = () => {
    if (!imgRef.current || !completedCrop) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cropped-image.jpg';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/jpeg');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-gray-800">Smart Image Cropper</h1>
          
          <div className="space-y-6">
            {/* Upload Section - Only show when no image is selected */}
            {!imgSrc && (
              <div
                className={clsx(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer inline-flex flex-col items-center"
                >
                  <Upload className="w-12 h-12 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-xs text-gray-500">
                    JPG, PNG files are supported
                  </span>
                </label>
              </div>
            )}

            {/* Aspect Ratio Controls */}
            {imgSrc && (
              <div className="flex gap-4 justify-center">
                <button
                  className={clsx(
                    "px-4 py-2 rounded-md flex items-center gap-2",
                    aspect === 1 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"
                  )}
                  onClick={() => setAspect(1)}
                >
                  <Square className="w-4 h-4" />
                  1:1
                </button>
                <button
                  className={clsx(
                    "px-4 py-2 rounded-md flex items-center gap-2",
                    aspect === 4/5 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"
                  )}
                  onClick={() => setAspect(4/5)}
                >
                  <ImageIcon className="w-4 h-4" />
                  4:5
                </button>
                <button
                  className={clsx(
                    "px-4 py-2 rounded-md flex items-center gap-2",
                    aspect === 16/9 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"
                  )}
                  onClick={() => setAspect(16/9)}
                >
                  <Maximize2 className="w-4 h-4" />
                  16:9
                </button>
              </div>
            )}

            {/* Cropping Area */}
            {imgSrc && (
              <div className="relative">
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                  </div>
                )}
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspect}
                  className="max-h-[600px] mx-auto"
                >
                  <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imgSrc}
                    onLoad={onImageLoad}
                    className="max-h-[600px] mx-auto"
                  />
                </ReactCrop>
              </div>
            )}

            {/* Action Buttons */}
            {imgSrc && (
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleCancel}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                {completedCrop && (
                  <button
                    onClick={downloadCroppedImage}
                    className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Cropped Image
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;