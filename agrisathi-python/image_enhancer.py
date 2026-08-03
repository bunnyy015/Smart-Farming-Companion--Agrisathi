from __future__ import annotations

import cv2
import numpy as np


MAXIMUM_IMAGE_SIZE = 1280


def resize_image(
    image: np.ndarray,
    maximum_size: int = MAXIMUM_IMAGE_SIZE,
) -> np.ndarray:
    height, width = image.shape[:2]

    if max(height, width) <= maximum_size:
        return image

    scale = maximum_size / max(height, width)

    new_width = max(1, int(width * scale))
    new_height = max(1, int(height * scale))

    return cv2.resize(
        image,
        (new_width, new_height),
        interpolation=cv2.INTER_AREA,
    )


def improve_brightness_and_contrast(
    image: np.ndarray,
) -> np.ndarray:
    lab_image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2LAB,
    )

    lightness, channel_a, channel_b = cv2.split(
        lab_image
    )

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8),
    )

    improved_lightness = clahe.apply(lightness)

    improved_lab = cv2.merge(
        (
            improved_lightness,
            channel_a,
            channel_b,
        )
    )

    return cv2.cvtColor(
        improved_lab,
        cv2.COLOR_LAB2BGR,
    )


def reduce_noise(
    image: np.ndarray,
) -> np.ndarray:
    return cv2.fastNlMeansDenoisingColored(
        image,
        None,
        5,
        5,
        7,
        21,
    )


def sharpen_image(
    image: np.ndarray,
) -> np.ndarray:
    blurred_image = cv2.GaussianBlur(
        image,
        (0, 0),
        sigmaX=1.2,
    )

    return cv2.addWeighted(
        image,
        1.25,
        blurred_image,
        -0.25,
        0,
    )


def calculate_image_information(
    original_image: np.ndarray,
    enhanced_image: np.ndarray,
) -> dict:
    original_gray = cv2.cvtColor(
        original_image,
        cv2.COLOR_BGR2GRAY,
    )

    enhanced_gray = cv2.cvtColor(
        enhanced_image,
        cv2.COLOR_BGR2GRAY,
    )

    original_sharpness = cv2.Laplacian(
        original_gray,
        cv2.CV_64F,
    ).var()

    enhanced_sharpness = cv2.Laplacian(
        enhanced_gray,
        cv2.CV_64F,
    ).var()

    return {
        "originalWidth": int(
            original_image.shape[1]
        ),
        "originalHeight": int(
            original_image.shape[0]
        ),
        "enhancedWidth": int(
            enhanced_image.shape[1]
        ),
        "enhancedHeight": int(
            enhanced_image.shape[0]
        ),
        "originalBrightness": round(
            float(np.mean(original_gray)),
            2,
        ),
        "enhancedBrightness": round(
            float(np.mean(enhanced_gray)),
            2,
        ),
        "originalSharpness": round(
            float(original_sharpness),
            2,
        ),
        "enhancedSharpness": round(
            float(enhanced_sharpness),
            2,
        ),
    }


def enhance_crop_image(
    image: np.ndarray,
) -> np.ndarray:
    resized_image = resize_image(image)

    brightness_improved_image = (
        improve_brightness_and_contrast(
            resized_image
        )
    )

    noise_reduced_image = reduce_noise(
        brightness_improved_image
    )

    enhanced_image = sharpen_image(
        noise_reduced_image
    )

    return enhanced_image