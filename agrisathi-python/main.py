from __future__ import annotations
import base64
from typing import Final
import cv2
import numpy as np
from fastapi import (
    FastAPI,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.middleware.cors import (
    CORSMiddleware,
)

MAX_FILE_SIZE: Final[int] = 10 * 1024 * 1024
SUPPORTED_TYPES: Final[set[str]] = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

app = FastAPI(
    title="AgriSaathi Image Enhancement API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=(
        r"^http://"
        r"(192\.168\.\d+\.\d+"
        r"|10\.\d+\.\d+\.\d+"
        r"|172\.(1[6-9]|2\d|3[0-1])"
        r"\.\d+\.\d+)"
        r":5173$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def resize_image(
    image: np.ndarray,
    maximum_width: int = 1280,
    maximum_height: int = 1280,
) -> np.ndarray:
    height, width = image.shape[:2]
    if width <= maximum_width and height <= maximum_height:
        return image

    scale = min(maximum_width / width, maximum_height / height)
    new_width = max(1, int(width * scale))
    new_height = max(1, int(height * scale))

    return cv2.resize(
        image,
        (new_width, new_height),
        interpolation=cv2.INTER_AREA,
    )

def improve_brightness_and_contrast(image: np.ndarray) -> np.ndarray:
    lab_image = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, channel_a, channel_b = cv2.split(lab_image)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    improved_lightness = clahe.apply(lightness)

    improved_lab = cv2.merge((improved_lightness, channel_a, channel_b))
    return cv2.cvtColor(improved_lab, cv2.COLOR_LAB2BGR)

def reduce_noise(image: np.ndarray) -> np.ndarray:
    return cv2.fastNlMeansDenoisingColored(
        image,
        None,
        5,
        5,
        7,
        21,
    )

def sharpen_image(image: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(image, (0, 0), sigmaX=1.2)
    return cv2.addWeighted(image, 1.25, blurred, -0.25, 0)

def calculate_image_information(original: np.ndarray, enhanced: np.ndarray) -> dict:
    original_gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
    enhanced_gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)

    original_sharpness = cv2.Laplacian(original_gray, cv2.CV_64F).var()
    enhanced_sharpness = cv2.Laplacian(enhanced_gray, cv2.CV_64F).var()

    return {
        "originalWidth": int(original.shape[1]),
        "originalHeight": int(original.shape[0]),
        "enhancedWidth": int(enhanced.shape[1]),
        "enhancedHeight": int(enhanced.shape[0]),
        "originalBrightness": round(float(np.mean(original_gray)), 2),
        "enhancedBrightness": round(float(np.mean(enhanced_gray)), 2),
        "originalSharpness": round(float(original_sharpness), 2),
        "enhancedSharpness": round(float(enhanced_sharpness), 2),
    }

def encode_image_as_base64(image: np.ndarray) -> str:
    success, encoded_image = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Enhanced image could not be encoded.",
        )
    return base64.b64encode(encoded_image.tobytes()).decode("utf-8")

@app.get("/")
def root() -> dict:
    return {
        "service": "AgriSaathi Image Enhancement API",
        "status": "running",
    }

@app.get("/health")
def health() -> dict:
    return {"status": "healthy"}

@app.post("/enhance-image")
async def enhance_image(file: UploadFile = File(...)) -> dict:
    if file.content_type not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG, PNG and WEBP images are supported.",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="The image must be smaller than 10 MB.")

    image_array = np.frombuffer(file_bytes, dtype=np.uint8)
    original_image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if original_image is None:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

    resized_image = resize_image(original_image)
    enhanced_image = improve_brightness_and_contrast(resized_image)
    enhanced_image = reduce_noise(enhanced_image)
    enhanced_image = sharpen_image(enhanced_image)

    image_information = calculate_image_information(original_image, enhanced_image)
    enhanced_base64 = encode_image_as_base64(enhanced_image)

    return {
        "success": True,
        "message": "Crop image enhanced successfully.",
        "image": {
            "mimeType": "image/jpeg",
            "base64": enhanced_base64,
            "dataUrl": "data:image/jpeg;base64," + enhanced_base64,
        },
        "information": image_information,
    }