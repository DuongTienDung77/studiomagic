/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {createRoot} from 'react-dom/client';
// Fix: Correct import based on guidelines, including Modality where needed.
import {GoogleGenAI, Modality} from '@google/genai';

// --- CONSTANTS & TYPES ---
type Page = 'home' | 'pose' | 'prop' | 'design' | 'creative' | 'stylist' | 'architect' | 'video' | 'magic' | 'background';
type Theme = 'light' | 'dark';
type Language = 'en' | 'vi';
type ControlMode = 'Pose' | 'Edge' | 'Depth' | 'Creative';
type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';
type VideoGenerationMode = 'text' | 'image';
type VideoAspectRatio = '9:16' | '16:9' | '1:1';
type VideoQuality = '720p' | '1080p';

interface UploadedImage {
    apiPayload: {
        inlineData: {
            data: string;
            mimeType: string;
        }
    };
    dataUrl: string;
}

const APP_NAME = 'AI Magic Tool Studio';

interface StructuredPreset {
  label: {[key in Language]: string};
  style: string;
  camera: string;
  lighting: string;
  mood: string;
  aspect?: string;
  beauty: 'on' | 'off';
}

const PRESET_CONTROLLER = {
    quality_block: 'ultra-high detail, professional grade, 8K native resolution (8192x8192 pixels), ACES-like cinematic tone mapping, maximum detail preservation, no upscaling. The final output must be extremely high-resolution.',
    global_defaults: {
        render: { resolution: '8192x8192' },
        aspect_fallback: '1:1',
        color_pipeline: 'ACES-cinematic',
        noise_floor: '0.01',
    },
    generation_instruction: 'Generate a single, rasterized image based on the user\'s input images and the detailed prompt. Adhere strictly to all quality, global, and preset parameters. Output only the image.',
};

const PRESETS: Record<string, StructuredPreset> = {
    'portrait-studio': {
        label: { en: 'Portrait: Studio', vi: 'Chân dung: Studio' },
        style: 'classic, clean, professional',
        camera: '85mm f/1.4 lens, shallow depth of field, sharp focus on eyes',
        lighting: 'three-point setup, softbox key light, subtle rim light',
        mood: 'elegant, timeless, focused',
        aspect: '3:4',
        beauty: 'on',
    },
    'portrait-outdoor-sunny': {
        label: { en: 'Portrait: Outdoor Sunny', vi: 'Chân dung: Ngoài trời nắng' },
        style: 'natural, vibrant, lifestyle',
        camera: '50mm f/1.8, bokeh background, natural framing',
        lighting: 'golden hour sunlight, warm tones, lens flare',
        mood: 'happy, bright, energetic',
        aspect: '3:4',
        beauty: 'on',
    },
    'portrait-outdoor-overcast': {
        label: { en: 'Portrait: Outdoor Overcast', vi: 'Chân dung: Ngoài trời u ám' },
        style: 'soft, diffused, moody',
        camera: '85mm f/1.8, medium depth of field',
        lighting: 'overcast day, soft natural light, even skin tones',
        mood: 'calm, introspective, gentle',
        aspect: '3:4',
        beauty: 'on',
    },
    'fashion-editorial': {
        label: { en: 'Fashion: Editorial', vi: 'Thời trang: Tạp chí' },
        style: 'high fashion, avant-garde, dynamic',
        camera: '35mm or 50mm lens, full-body shots, unconventional angles',
        lighting: 'hard light, dramatic shadows, styled studio lighting',
        mood: 'confident, powerful, artistic',
        aspect: '4:5',
        beauty: 'on',
    },
    'fashion-beauty-commercial': {
        label: { en: 'Fashion: Beauty Commercial', vi: 'Thời trang: Quảng cáo Beauty' },
        style: 'clean, flawless, polished',
        camera: '100mm macro lens, close-up on face, perfect skin texture',
        lighting: 'ring light or beauty dish, no shadows, bright and clean',
        mood: 'luxurious, perfect, radiant',
        aspect: '1:1',
        beauty: 'on',
    },
    'lifestyle-street': {
        label: { en: 'Lifestyle: Street', vi: 'Đời thường: Đường phố' },
        style: 'candid, authentic, urban',
        camera: '28mm or 35mm lens, reportage style, capturing moments',
        lighting: 'natural city light, reflections, neon signs at night',
        mood: 'real, energetic, spontaneous',
        aspect: '16:9',
        beauty: 'off',
    },
    'lifestyle-corporate': {
        label: { en: 'Lifestyle: Corporate', vi: 'Đời thường: Doanh nghiệp' },
        style: 'professional, modern, clean',
        camera: '50mm lens, environmental portraits in an office setting',
        lighting: 'soft window light or professional strobes, clean and bright',
        mood: 'successful, confident, approachable',
        aspect: '3:2',
        beauty: 'off',
    },
    'fine-art-drama': {
        label: { en: 'Fine Art: Drama', vi: 'Nghệ thuật: Kịch tính' },
        style: 'painterly, emotional, chiaroscuro',
        camera: '50mm prime lens, deliberate composition',
        lighting: 'single light source, deep shadows, high contrast',
        mood: 'intense, soulful, mysterious',
        aspect: '4:5',
        beauty: 'off',
    },
    'fine-art-bw': {
        label: { en: 'Fine Art: Black & White', vi: 'Nghệ thuật: Đen trắng' },
        style: 'timeless, graphic, minimalist',
        camera: 'various lenses, focus on texture, shape, and form',
        lighting: 'high contrast, directional light to create shapes',
        mood: 'classic, emotional, profound',
        aspect: '1:1',
        beauty: 'off',
    },
    'landscape-nature': {
        label: { en: 'Landscape: Nature', vi: 'Phong cảnh: Thiên nhiên' },
        style: 'epic, breathtaking, vibrant',
        camera: '16-35mm wide-angle lens, deep depth of field, leading lines',
        lighting: 'sunrise or sunset, dramatic sky, atmospheric conditions',
        mood: 'majestic, peaceful, wild',
        aspect: '16:9',
        beauty: 'off',
    },
    'landscape-cityscape': {
        label: { en: 'Landscape: Cityscape', vi: 'Phong cảnh: Thành phố' },
        style: 'dynamic, modern, futuristic',
        camera: 'wide-angle lens, long exposure for light trails',
        lighting: 'blue hour, city lights, reflections on wet streets',
        mood: 'vibrant, bustling, impressive',
        aspect: '16:9',
        beauty: 'off',
    },
    'landscape-epic-fantasy': {
        label: { en: 'Landscape: Epic Fantasy', vi: 'Phong cảnh: Giả tưởng Sử thi' },
        style: 'painterly, grand scale, imaginative, Lord of the Rings inspired',
        camera: 'ultra-wide lens, dramatic perspective, leading lines into mythical structures',
        lighting: 'god rays, magical glowing elements, dramatic storm clouds, sunrise/sunset',
        mood: 'awe-inspiring, adventurous, mythical, ancient',
        aspect: '16:9',
        beauty: 'off',
    },
    'architecture-exterior': {
        label: { en: 'Architecture: Exterior', vi: 'Kiến trúc: Ngoại thất' },
        style: 'clean, geometric, powerful',
        camera: 'tilt-shift lens to correct perspective, sharp focus',
        lighting: 'bright daylight to create strong lines and shadows',
        mood: 'minimalist, grand, structured',
        aspect: '4:5',
        beauty: 'off',
    },
    'architecture-interior': {
        label: { en: 'Architecture: Interior', vi: 'Kiến trúc: Nội thất' },
        style: 'warm, inviting, well-designed',
        camera: 'ultra-wide lens, one-point perspective, focus on details',
        lighting: 'ambient light, soft window light, warm artificial lights',
        mood: 'cozy, elegant, spacious',
        aspect: '4:3',
        beauty: 'off',
    },
    'product-commercial': {
        label: { en: 'Product: Commercial', vi: 'Sản phẩm: Thương mại' },
        style: 'sleek, desirable, high-end',
        camera: '100mm macro lens, focus stacking for ultimate sharpness',
        lighting: 'studio lighting, gradient backgrounds, perfect reflections',
        mood: 'premium, clean, attractive',
        aspect: '1:1',
        beauty: 'off',
    },
    'product-food': {
        label: { en: 'Product: Food', vi: 'Sản phẩm: Ẩm thực' },
        style: 'delicious, fresh, appetizing',
        camera: 'macro lens, focus on texture, shallow depth of field',
        lighting: 'soft natural light, backlight to show steam or texture',
        mood: 'tasty, rustic, vibrant',
        aspect: '4:5',
        beauty: 'off',
    },
    'product-food-dark': {
        label: { en: 'Product: Food (Dark & Moody)', vi: 'Sản phẩm: Ẩm thực (Tối & Sâu lắng)' },
        style: 'dramatic, textured, rustic, chiaroscuro',
        camera: 'macro lens, tight crop, shallow depth of field',
        lighting: 'single directional light source from the side or back, deep shadows',
        mood: 'rich, artisanal, sophisticated, tempting',
        aspect: '4:5',
        beauty: 'off',
    },
    'product-macro': {
        label: { en: 'Product: Macro', vi: 'Sản phẩm: Cận cảnh' },
        style: 'detailed, intricate, abstract',
        camera: 'true macro 1:1 lens, extreme close-up',
        lighting: 'specialized ring or twin lights to illuminate tiny details',
        mood: 'fascinating, scientific, beautiful',
        aspect: '1:1',
        beauty: 'off',
    },
    'special-night-street': {
        label: { en: 'Special: Night Street', vi: 'Đặc biệt: Phố đêm' },
        style: 'cyberpunk, neon, cinematic',
        camera: 'fast prime lens (f/1.4), handheld, capturing motion',
        lighting: 'neon signs, streetlights, creating a colorful, moody scene',
        mood: 'futuristic, mysterious, alive',
        aspect: '16:9',
        beauty: 'off',
    },
    'special-wedding': {
        label: { en: 'Special: Wedding', vi: 'Đặc biệt: Đám cưới' },
        style: 'romantic, dreamy, emotional',
        camera: '85mm f/1.4 for portraits, 35mm for moments, soft focus',
        lighting: 'natural light, golden hour, fairy lights',
        mood: 'loving, happy, timeless',
        aspect: '3:2',
        beauty: 'on',
    },
    'special-newborn': {
        label: { en: 'Special: Newborn', vi: 'Đặc biệt: Trẻ sơ sinh' },
        style: 'tender, pure, delicate',
        camera: '50mm macro, close-up on details, very shallow DoF',
        lighting: 'large, soft window light, warm and gentle',
        mood: 'innocent, peaceful, loving',
        aspect: '4:5',
        beauty: 'off',
    },
    'special-sports': {
        label: { en: 'Special: Sports', vi: 'Đặc biệt: Thể thao' },
        style: 'dynamic, powerful, action-packed',
        camera: 'telephoto lens (300mm+), fast shutter speed, panning',
        lighting: 'stadium lights or harsh daylight, creating drama',
        mood: 'energetic, competitive, triumphant',
        aspect: '16:9',
        beauty: 'off',
    },
    'special-wildlife': {
        label: { en: 'Special: Wildlife', vi: 'Đặc biệt: Động vật hoang dã' },
        style: 'natural, majestic, candid',
        camera: 'long telephoto lens (600mm+), eye-level with the animal',
        lighting: 'early morning or late afternoon light',
        mood: 'wild, free, respectful',
        aspect: '3:2',
        beauty: 'off',
    },
    'special-aerial': {
        label: { en: 'Special: Aerial', vi: 'Đặc biệt: Trên không' },
        style: 'epic, abstract, birds-eye view',
        camera: 'drone camera, wide-angle, top-down perspective',
        lighting: 'midday sun for patterns or golden hour for long shadows',
        mood: 'grand, expansive, unique',
        aspect: '16:9',
        beauty: 'off',
    },
    'special-conceptual': {
        label: { en: 'Special: Conceptual', vi: 'Đặc biệt: Ý niệm' },
        style: 'surreal, thought-provoking, artistic',
        camera: 'any lens, focus on the idea, not realism',
        lighting: 'lighting to serve the concept, can be unnatural or symbolic',
        mood: 'mysterious, intellectual, imaginative',
        aspect: '4:5',
        beauty: 'off',
    },
    'special-vintage-film': {
        label: { en: 'Special: Vintage Film', vi: 'Đặc biệt: Phim Cổ điển' },
        style: 'nostalgic, grainy, faded colors, analog film emulation (like Kodachrome or Portra 400)',
        camera: '50mm prime lens, classic composition, slight vignetting',
        lighting: 'natural, slightly underexposed, warm golden hour tones',
        mood: 'sentimental, timeless, authentic, cinematic',
        aspect: '3:2',
        beauty: 'off',
    },
    'art-fantasy': {
        label: { en: 'Art: Fantasy', vi: 'Nghệ thuật: Giả tưởng' },
        style: 'magical, epic, illustrative',
        camera: 'cinematic angles, wide shots for environments, portraits for characters',
        lighting: 'glowing magical light, dramatic god rays, ethereal glow',
        mood: 'adventurous, mystical, enchanting',
        aspect: '16:9',
        beauty: 'on',
    },
    'art-sci-fi': {
        label: { en: 'Art: Sci-Fi', vi: 'Nghệ thuật: Khoa học viễn tưởng' },
        style: 'futuristic, technological, sleek',
        camera: 'anamorphic lens look, clean lines, vast cityscapes or tight ship interiors',
        lighting: 'holographic projections, neon highlights, cold metallic reflections',
        mood: 'awe-inspiring, advanced, dystopian or utopian',
        aspect: '21:9',
        beauty: 'off',
    },
    'art-cyberpunk-city': {
        label: { en: 'Art: Cyberpunk Cityscape', vi: 'Nghệ thuật: Thành phố Cyberpunk' },
        style: 'futuristic, neon-drenched, dystopian, high-tech',
        camera: 'wide-angle lens, low angle, dynamic composition, cinematic',
        lighting: 'glowing neon signs, reflections on wet pavement, volumetric fog',
        mood: 'gritty, mysterious, vibrant, alive',
        aspect: '21:9',
        beauty: 'off',
    },
    'art-watercolor-portrait': {
        label: { en: 'Art: Watercolor Portrait', vi: 'Nghệ thuật: Chân dung Màu nước' },
        style: 'soft, translucent, blended colors, expressive brushstrokes',
        camera: 'n/a (artistic interpretation), focus on emotion',
        lighting: 'diffused, high-key lighting, soft shadows, mimicking natural light on paper',
        mood: 'dreamy, delicate, artistic, gentle',
        aspect: '3:4',
        beauty: 'on',
    },
    'special-abstract-geometric': {
        label: { en: 'Art: Abstract Geometric', vi: 'Nghệ thuật: Trừu tượng Hình học' },
        style: 'minimalist, clean lines, bold shapes, bauhaus inspired, non-representational',
        camera: 'n/a (graphic design), precision and balance',
        lighting: 'flat, even lighting to emphasize form and color',
        mood: 'modern, intellectual, orderly, sophisticated',
        aspect: '1:1',
        beauty: 'off',
    },
};

const buildPresetDirective = (presetId: string, overrides?: { beauty?: 'on' | 'off', aspect?: string }) => {
    const p = PRESETS[presetId];
    if (!p) return '';
    const aspect = overrides?.aspect && overrides.aspect !== 'auto' ? overrides.aspect : (p.aspect ?? PRESET_CONTROLLER.global_defaults.aspect_fallback);
    const beauty = overrides?.beauty ?? p.beauty;

    const quality = `[QUALITY] ${PRESET_CONTROLLER.quality_block}`;
    const global = `[GLOBAL] aspect=${aspect}; pipeline=${PRESET_CONTROLLER.global_defaults.color_pipeline}; noise_floor=${PRESET_CONTROLLER.global_defaults.noise_floor}.`;
    const preset = `[PRESET:${presetId}] style=${p.style}; camera=${p.camera}; lighting=${p.lighting}; mood=${p.mood}; beauty=${beauty}.`;
    const instruction = `[INSTRUCTION] ${PRESET_CONTROLLER.generation_instruction}`;
    
    return `${quality}\n\n${global}\n${preset}\n${instruction}`;
}

const getDownloadFilename = (dataUrl: string | null): string => {
    if (!dataUrl) return "generated-image.png";
    try {
        const mimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
        let extension = mimeType.split('/')[1];
        if (extension === 'jpeg') {
            extension = 'jpg';
        }
        return `generated-image.${extension}`;
    } catch (e) {
        return "generated-image.png";
    }
};


const CONTROL_MODES: ControlMode[] = ['Pose', 'Edge', 'Depth', 'Creative'];

const ASPECT_RATIOS = [
  { value: 'auto', label: { en: 'Auto (from model image)', vi: 'Tự động (theo ảnh gốc)' } },
  { value: '1:1', label: { en: '1:1 (Square)', vi: '1:1 (Vuông)' } },
  { value: '3:4', label: { en: '3:4 (Portrait)', vi: '3:4 (Dọc)' } },
  { value: '4:3', label: { en: '4:3 (Landscape)', vi: '4:3 (Ngang)' } },
  { value: '4:5', label: { en: '4:5 (Portrait)', vi: '4:5 (Dọc)' } },
  { value: '2:3', label: { en: '2:3 (Portrait)', vi: '2:3 (Dọc)' } },
  { value: '3:2', label: { en: '3:2 (Landscape)', vi: '3:2 (Ngang)' } },
  { value: '16:9', label: { en: '16:9 (Widescreen)', vi: '16:9 (Màn ảnh rộng)' } },
  { value: '9:16', label: { en: '9:16 (Tall)', vi: '9:16 (Cao)' } },
  { value: '21:9', label: { en: '21:9 (Cinematic)', vi: '21:9 (Điện ảnh)' } },
];

const TRANSLATIONS = {
  en: {
    // General
    appName: APP_NAME,
    generate: 'Generate',
    generating: 'Generating...',
    goBack: 'Go Back',
    download: 'Download',
    // Header
    toggleTheme: 'Toggle Theme',
    language: 'Language',
    apiKey: 'API Key',
    // API Key Modal
    enterApiKey: 'Enter Google Gemini API Key',
    apiKeyInstructions: 'Go to AI Studio → Get API key → Copy → Paste. Your key will be stored in your browser.',
    getApiKey: 'Get API Key',
    checkKey: 'Check',
    saveKey: 'Save Key',
    deleteKey: 'Delete Key',
    cancel: 'Cancel',
    keyValid: 'API Key is valid.',
    keyInvalid: 'Invalid API Key. Please check it and try again.',
    checkingKey: 'Checking...',
    keySaved: 'API Key saved.',
    keyDeleted: 'API Key deleted.',
    apiKeyRequired: 'Please set your API Key first.',
    // Home Page
    homeTitle: 'Unleash Your Creativity',
    homeSubtitle: 'Choose a tool to begin your AI-powered artistic journey.',
    poseStudioTitle: 'Pose Studio',
    poseStudioDesc: 'Animate your character with any pose from a sketch.',
    propFusionTitle: 'Prop Fusion',
    propFusionDesc: 'Seamlessly integrate any prop into your image.',
    designStudioTitle: 'AI Design',
    designStudioDesc: 'Blend subject with background & artistic styles.',
    creativeStudioTitle: 'AI Creative',
    creativeStudioDesc: 'Turn your text descriptions into stunning images.',
    stylistStudioTitle: 'AI Stylist',
    stylistStudioDesc: 'Try any outfit on a model instantly.',
    architectStudioTitle: 'AI Architect',
    architectStudioDesc: 'Turn 2D sketches into realistic 3D architectural renders.',
    videoStudioTitle: 'AI Video Create',
    videoStudioDesc: 'Create stunning videos from text or images.',
    magicStudioTitle: 'AI Magic',
    magicStudioDesc: 'Beautify, restore old photos, and upscale with one click.',
    backgroundStudioTitle: 'AI Background Remover',
    backgroundStudioDesc: 'Remove the background from any image with one click.',
    // Tool Page
    uploadCharacter: 'Upload Character',
    uploadPose: 'Upload Pose Sketch',
    uploadProp: 'Upload Prop',
    uploadSubject: 'Upload Subject',
    uploadBackground: 'Upload Background',
    uploadModel: 'Upload Model',
    uploadOutfit: 'Upload Outfit',
    uploadBlueprint: 'Upload Blueprint / Sketch',
    uploadImage: 'Upload Image',
    uploadSourceImage: 'Upload Source Image',
    uploadContext: 'Upload Context / Background',
    imagePrompt: 'Image Prompt',
    imagePromptPlaceholder: 'Describe the image you want to create in detail...',
    videoPrompt: 'Video Prompt',
    videoPromptPlaceholder: 'Describe the video you want to create...',
    positivePrompt: 'Positive Prompt',
    positivePromptPlaceholder: 'Describe details you want to add...',
    positivePromptExample: 'e.g., high quality, sharp details, natural lighting...',
    negativePrompt: 'Negative Prompt',
    negativePromptPlaceholder: 'Describe what you want to avoid...',
    negativePromptExample: 'e.g., blurry, deformed, unnatural hands, low quality...',
    // Default Prompts
    stylistPositiveDefault: 'hyper-realistic, detailed, 8k',
    stylistNegativeDefault: 'blurry, distorted, malformed, deformed',
    autoPreset: 'Auto (from model image)',
    propFusionPositiveDefault: 'hyper-realistic, detailed, 8k, seamless integration',
    propFusionNegativeDefault: 'blurry, distorted, floating, discolored, malformed, deformed',
    designPositiveDefault: 'masterpiece, 8k, high quality, trending on artstation',
    designNegativeDefault: 'blurry, bad art, poorly drawn, deformed',
    creativeNegativeDefault: 'ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, blurry, bad anatomy, blurred, watermark, grainy, signature, cut off, draft',
    architectPositiveDefault: 'photorealistic render, octane render, unreal engine 5, 8k, detailed materials, cinematic lighting',
    architectNegativeDefault: 'cartoon, sketch, drawing, watermark, signature, ugly',
    dragOrClick: 'Drag & drop or click to upload',
    preview: 'Preview',
    result: 'Result',
    preset: 'Preset',
    controlMode: 'Control Mode',
    aspectRatio: 'Aspect Ratio',
    outputFormat: 'Output Format',
    beautify: 'Beautify',
    beautifyHint: '(Only applies to portrait presets)',
    error: 'An error occurred. Please try again.',
    // Control Modes
    controlModePose: 'Pose',
    controlModeEdge: 'Edge',
    controlModeDepth: 'Depth',
    controlModeCreative: 'Creative',
    controlModeDesc_Pose: 'Precisely copies the human pose from the reference sketch. Best for character control.',
    controlModeDesc_Edge: 'Uses outlines (edges) from the reference to guide generation. Ideal for line art and sketch-based styles.',
    controlModeDesc_Depth: 'Maintains the 3D structure and depth of the scene from the reference. Good for environmental consistency.',
    controlModeDesc_Creative: 'Gives the AI more freedom to creatively reinterpret the inputs based on the prompt.',
    // Tabs
    features: 'Features',
    guide: 'Guide',
    tips: 'Tips',
    // Tool Info Content
    poseFeatures: ['Animate your character with any pose from a sketch.', 'Utilize a wide range of professional presets.', 'Preset Controller v3 for 8K cinematic output.'],
    poseGuide: ['1. Upload your character image.', '2. Upload a clear pose sketch.', '3. Select a style preset and control mode.', '4. (Optional) Refine with prompts.', '5. Click "Generate"!'],
    poseTips: ['Use sketches with clear, single-color lines for best results.', 'Transparent background (PNG) for the character is recommended.', 'The "Edge" control mode is great for comic styles.'],
    propFeatures: ['Seamlessly integrate any prop into your image.', 'AI matches lighting, perspective, and shadows.', 'Perfect for adding accessories, objects, or effects.'],
    propGuide: ['1. Upload the main scene/character image.', '2. Upload the prop image.', '3. Select a preset that matches the scene.', '4. (Optional) Guide the integration with prompts.', '5. Click "Generate"!'],
    propTips: ["Use prop images with a clean or transparent background.", "For best results, ensure the prop's perspective is similar to the main image.", "Describe how the prop should interact with the scene in the positive prompt."],
    designFeatures: ['Blend subject with artistic backgrounds.', 'Apply numerous artistic styles.', 'Preset Controller v3 for 8K cinematic output.'],
    designGuide: ['1. Upload a clear subject image.', '2. Upload the desired background image.', '3. Select a preset to define the style.', '4. (Optional) Write additional prompts for refinement.', '5. Click "Generate" and wait for the result!'],
    designTips: ['Use subject images with transparent backgrounds (PNG) for best results.', '"Art" and "Fantasy" presets create impressive effects.', 'Experiment with different positive and negative prompts.'],
    creativeFeatures: ['Turn your text descriptions into stunning images.', 'Leverages powerful presets for specific styles.', 'Full control over aspect ratio and fine details.'],
    creativeGuide: ['1. Write a detailed description of your desired image.', '2. Select a preset that matches your vision (e.g., Sci-Fi, Portrait).', '3. Choose your desired aspect ratio.', '4. Use negative prompts to exclude unwanted elements.', '5. Click "Generate"!'],
    creativeTips: ['Be specific! Instead of "a car", try "a red 1960s convertible sports car".', 'Use commas to combine different concepts.', 'The "Beautify" option works great for creating characters.'],
    stylistFeatures: ['Instantly try any outfit on a model.', 'Realistic fabric textures and draping.', "Maintains the model's identity and pose."],
    stylistGuide: ['1. Upload a full-body photo of the model.', '2. Upload a clear image of the clothing item.', '3. Choose a fashion-related preset.', '4. (Optional) Specify fabric type in the prompt.', '5. Click "Generate"!'],
    stylistTips: ['Use clear, front-facing photos of both the model and the outfit.', 'Simple backgrounds work best for both images.', 'Ensure the outfit image shows the entire garment.'],
    architectFeatures: ['Transform 2D sketches into realistic 3D renders.', 'Supports interior and exterior designs.', 'Cinematic lighting and high-quality materials.'],
    architectGuide: ['1. Upload a blueprint or architectural sketch.', '2. Choose an appropriate preset (e.g., Exterior, Interior).', '3. Use prompts to specify materials, time of day, and mood.', '4. (Optional) Use negative prompts to avoid cartoony looks.', '5. Click "Generate"!'],
    architectTips: ['High-contrast, clean line drawings work best.', 'Specify materials like "oak wood floor", "concrete walls".', 'For lighting, try prompts like "golden hour lighting" or "soft morning light".'],
    magicFeatures: ['One-click photo enhancement.', 'Combine multiple effects like beautify, restore, and upscale.', "Advanced AI ensures the subject's identity is perfectly preserved."],
    magicGuide: ['1. Upload the image you want to edit.', '2. Toggle the features you want to apply (e.g., Beautify, Restore).', '3. Ensure "Preserve Identity" is on for portraits.', '4. Click "Generate" to see the magic!'],
    magicTips: ['Works best with one primary subject.', 'The "Restore" feature is powerful for scanned family photos.', 'Upscaling can significantly increase detail, but may take a moment longer.'],
    backgroundFeatures: ['One-click background removal.', 'Outputs high-resolution PNG with transparency.', 'Perfect for product photos, portraits, and more.'],
    backgroundGuide: ['1. Upload the image you want to edit.', '2. Click "Generate"!', '3. Download your image with a transparent background.'],
    backgroundTips: ['Use images with a clear subject for the best results.', 'The output is a PNG, perfect for placing on new backgrounds.', 'High-resolution input images will produce high-resolution outputs.'],
    // Video Tool
    generateVideo: 'Generate Video',
    generatingVideo: 'Generating Video...',
    videoResult: 'Video Result',
    generationMode: 'Generation Mode',
    textToVideo: 'Text to Video',
    imageToVideo: 'Image to Video',
    videoWillAppear: 'Your generated video will appear here.',
    videoInProgress: 'Video generation in progress...',
    videoInProgressCompose: 'Step 1: Composing scene...||Step 2: Generating video...',
    videoTakesTime: 'This may take several minutes.',
    videoAspectRatio: 'Aspect Ratio',
    videoQuality: 'Quality',
    portrait: '9:16 (Portrait)',
    landscape: '16:9 (Landscape)',
    hd720: '720p (HD)',
    hd1080: '1080p (Full HD)',
    videoPromptRequired: 'Please enter a video prompt.',
    videoImageRequired: 'Please upload an image for Image-to-Video mode.',
    videoImageRequiredBoth: 'Please upload both a Character and a Context image.',
    videoAspectSquare: '1:1 (Square)',
    // Magic Tool
    magicBeautify: 'Beautify Skin',
    magicBeautifyDesc: 'Smooth skin, remove acne and blemishes.',
    magicRestore: 'Restore Old Photo',
    magicRestoreDesc: 'Fix blur, scratches, and color fading.',
    magicUpscale: 'Upscale Resolution',
    magicUpscaleDesc: 'Increase image size and sharpness.',
    preserveIdentity: 'Preserve Identity',
    preserveIdentityDesc: "Strictly maintain the person's original facial features.",
    errorNoMagicFeature: 'Please select at least one magic feature.',
  },
  vi: {
    // General
    appName: APP_NAME,
    generate: 'Tạo ảnh',
    generating: 'Đang tạo...',
    goBack: 'Quay lại',
    download: 'Tải xuống',
    // Header
    toggleTheme: 'Chuyển đổi Giao diện',
    language: 'Ngôn ngữ',
    apiKey: 'Khóa API',
    // API Key Modal
    enterApiKey: 'Nhập API Key Google Gemini',
    apiKeyInstructions: 'Vào AI Studio → Lấy khóa API → Sao chép → Dán. Key sẽ được lưu trong trình duyệt của bạn.',
    getApiKey: 'Lấy Khóa API',
    checkKey: 'Kiểm tra',
    saveKey: 'Lưu khóa',
    deleteKey: 'Xoá key',
    cancel: 'Hủy',
    keyValid: 'Khóa API hợp lệ.',
    keyInvalid: 'Khóa API không hợp lệ. Vui lòng kiểm tra lại.',
    checkingKey: 'Đang kiểm tra...',
    keySaved: 'Đã lưu khóa API.',
    keyDeleted: 'Đã xoá khóa API.',
    apiKeyRequired: 'Vui lòng nhập Khóa API của bạn trước.',
    // Home Page
    homeTitle: 'Giải phóng Sáng tạo',
    homeSubtitle: 'Chọn một công cụ để bắt đầu hành trình nghệ thuật với AI.',
    poseStudioTitle: 'Xưởng Tư thế',
    poseStudioDesc: 'Tạo dáng nhân vật của bạn theo bất kỳ tư thế nào từ phác thảo.',
    propFusionTitle: 'Hòa trộn Đạo cụ',
    propFusionDesc: 'Tích hợp liền mạch bất kỳ đạo cụ nào vào hình ảnh của bạn.',
    designStudioTitle: 'Thiết kế AI',
    designStudioDesc: 'Hòa trộn chủ thể với nền & phong cách nghệ thuật.',
    creativeStudioTitle: 'Sáng tạo AI',
    creativeStudioDesc: 'Biến mô tả văn bản của bạn thành hình ảnh tuyệt đẹp.',
    stylistStudioTitle: 'Thời trang AI',
    stylistStudioDesc: 'Thử bất kỳ trang phục nào trên người mẫu ngay lập tức.',
    architectStudioTitle: 'Kiến trúc AI',
    architectStudioDesc: 'Biến bản phác thảo 2D thành ảnh render kiến trúc 3D thực tế.',
    videoStudioTitle: 'Tạo Video AI',
    videoStudioDesc: 'Tạo video tuyệt đẹp từ văn bản hoặc hình ảnh.',
    magicStudioTitle: 'AI Ma Thuật',
    magicStudioDesc: 'Làm đẹp, phục chế ảnh cũ và nâng cấp độ phân giải.',
    backgroundStudioTitle: 'Xóa Nền AI',
    backgroundStudioDesc: 'Xóa nền khỏi bất kỳ hình ảnh nào chỉ bằng một cú nhấp chuột.',
    // Tool Page
    uploadCharacter: 'Tải lên Nhân vật',
    uploadPose: 'Tải lên Phác thảo Tư thế',
    uploadProp: 'Tải lên Đạo cụ',
    uploadSubject: 'Tải lên Chủ thể',
    uploadBackground: 'Tải lên Nền',
    uploadModel: 'Tải lên Người mẫu',
    uploadOutfit: 'Tải lên Trang phục',
    uploadBlueprint: 'Tải lên Bản thiết kế / Phác thảo',
    uploadImage: 'Tải lên Hình ảnh',
    uploadSourceImage: 'Tải lên Ảnh Gốc',
    uploadContext: 'Tải lên Bối cảnh / Nền',
    imagePrompt: 'Prompt Ảnh',
    imagePromptPlaceholder: 'Mô tả chi tiết hình ảnh bạn muốn tạo...',
    videoPrompt: 'Mô tả Video',
    videoPromptPlaceholder: 'Mô tả video bạn muốn tạo...',
    positivePrompt: 'Prompt Tích cực',
    positivePromptPlaceholder: 'Mô tả các chi tiết bạn muốn thêm...',
    positivePromptExample: 'VD: chất lượng cao, chi tiết sắc nét, ánh sáng tự nhiên...',
    negativePrompt: 'Prompt Tiêu cực',
    negativePromptPlaceholder: 'Mô tả những gì bạn muốn tránh...',
    negativePromptExample: 'VD: mờ, biến dạng, tay không tự nhiên, chất lượng thấp...',
    // Default Prompts
    stylistPositiveDefault: 'siêu thực, chi tiết, 8k',
    stylistNegativeDefault: 'mờ, méo mó, dị dạng, biến dạng',
    autoPreset: 'Tự động (theo ảnh mẫu)',
    propFusionPositiveDefault: 'siêu thực, chi tiết, 8k, tích hợp liền mạch',
    propFusionNegativeDefault: 'mờ, méo mó, lơ lửng, bạc màu, dị dạng, biến dạng',
    designPositiveDefault: 'kiệt tác, 8k, chất lượng cao, thịnh hành trên artstation',
    designNegativeDefault: 'mờ, nghệ thuật kém, vẽ xấu, biến dạng',
    creativeNegativeDefault: 'xấu, lặp lại, tay vẽ xấu, chân vẽ xấu, mặt vẽ xấu, ngoài khung hình, thừa chi, dị dạng, biến dạng, cơ thể ngoài khung hình, mờ, giải phẫu sai, nhoè, watermark, nhiễu hạt, chữ ký, cắt cảnh, bản nháp',
    architectPositiveDefault: 'render ảnh thực, render octane, unreal engine 5, 8k, vật liệu chi tiết, ánh sáng điện ảnh',
    architectNegativeDefault: 'hoạt hình, phác thảo, bản vẽ, watermark, chữ ký, xấu',
    dragOrClick: 'Kéo & thả hoặc nhấp để tải lên',
    preview: 'Xem trước',
    result: 'Kết quả',
    preset: 'Preset',
    controlMode: 'Chế độ Kiểm soát',
    aspectRatio: 'Tỷ lệ Khung hình',
    outputFormat: 'Định dạng Đầu ra',
    beautify: 'Làm đẹp da',
    beautifyHint: '(Chỉ áp dụng cho preset chân dung)',
    error: 'Đã xảy ra lỗi. Vui lòng thử lại.',
    // Control Modes
    controlModePose: 'Tư thế',
    controlModeEdge: 'Đường viền',
    controlModeDepth: 'Chiều sâu',
    controlModeCreative: 'Sáng tạo',
    controlModeDesc_Pose: 'Sao chép chính xác tư thế người từ bản phác thảo. Tốt nhất để kiểm soát tạo dáng nhân vật.',
    controlModeDesc_Edge: 'Sử dụng các đường viền (edges) từ ảnh tham chiếu để hướng dẫn tạo ảnh. Lý tưởng cho phong cách line art và phác thảo.',
    controlModeDesc_Depth: 'Duy trì cấu trúc 3D và chiều sâu của cảnh từ ảnh tham chiếu. Tốt cho sự nhất quán của môi trường.',
    controlModeDesc_Creative: 'Cho AI tự do hơn để diễn giải lại các hình ảnh đầu vào một cách sáng tạo dựa trên prompt.',
    // Tabs
    features: 'Tính năng',
    guide: 'Hướng dẫn',
    tips: 'Mẹo',
    // Tool Info Content
    poseFeatures: ['Tạo dáng nhân vật theo bất kỳ tư thế nào từ phác thảo.', 'Sử dụng nhiều preset chuyên nghiệp.', 'Preset Controller v3 cho đầu ra 8K điện ảnh.'],
    poseGuide: ['1. Tải lên ảnh nhân vật của bạn.', '2. Tải lên bản phác thảo tư thế rõ nét.', '3. Chọn preset phong cách và chế độ kiểm soát.', '4. (Tùy chọn) Tinh chỉnh bằng prompt.', '5. Nhấn "Tạo ảnh"!'],
    poseTips: ['Sử dụng phác thảo với đường nét rõ ràng, đơn sắc để có kết quả tốt nhất.', 'Nên dùng ảnh nhân vật có nền trong suốt (PNG).', 'Chế độ kiểm soát "Edge" rất phù hợp cho phong cách truyện tranh.'],
    propFeatures: ['Tích hợp liền mạch bất kỳ đạo cụ nào vào hình ảnh.', 'AI tự động điều chỉnh ánh sáng, phối cảnh và bóng đổ.', 'Hoàn hảo để thêm phụ kiện, đồ vật hoặc hiệu ứng.'],
    propGuide: ['1. Tải lên ảnh cảnh chính/nhân vật.', '2. Tải lên ảnh đạo cụ.', '3. Chọn một preset phù hợp với bối cảnh.', '4. (Tùy chọn) Hướng dẫn việc tích hợp bằng prompt.', '5. Nhấn "Tạo ảnh"!'],
    propTips: ['Sử dụng ảnh đạo cụ có nền sạch hoặc trong suốt.', 'Để có kết quả tốt nhất, hãy đảm bảo phối cảnh của đạo cụ tương tự ảnh chính.', 'Mô tả cách đạo cụ tương tác với cảnh trong prompt tích cực.'],
    designFeatures: ['Hòa trộn chủ thể với nền nghệ thuật.', 'Áp dụng nhiều phong cách nghệ thuật.', 'Preset Controller v3 cho đầu ra 8K điện ảnh.'],
    designGuide: ['1. Tải lên ảnh chủ thể rõ nét.', '2. Tải lên ảnh nền mong muốn.', '3. Chọn một preset để định hình phong cách.', '4. (Tùy chọn) Viết thêm prompt để tinh chỉnh.', '5. Nhấn "Tạo ảnh" và chờ kết quả!'],
    designTips: ['Sử dụng ảnh chủ thể đã tách nền (PNG) để có kết quả tốt nhất.', 'Các preset "Art" và "Fantasy" tạo ra hiệu ứng ấn tượng.', 'Hãy thử nghiệm với các prompt tích cực và tiêu cực khác nhau.'],
    creativeFeatures: ['Biến mô tả văn bản của bạn thành hình ảnh tuyệt đẹp.', 'Tận dụng các preset mạnh mẽ cho các phong cách cụ thể.', 'Kiểm soát hoàn toàn tỷ lệ khung hình và chi tiết.'],
    creativeGuide: ['1. Viết mô tả chi tiết về hình ảnh bạn muốn.', '2. Chọn một preset phù hợp với ý tưởng của bạn (VD: Viễn tưởng, Chân dung).', '3. Chọn tỷ lệ khung hình mong muốn.', '4. Sử dụng prompt tiêu cực để loại bỏ các yếu tố không mong muốn.', '5. Nhấn "Tạo ảnh"!'],
    creativeTips: ['Hãy cụ thể! Thay vì "một chiếc xe", hãy thử "một chiếc xe thể thao mui trần màu đỏ thập niên 1960".', 'Sử dụng dấu phẩy để kết hợp các khái niệm khác nhau.', 'Tùy chọn "Làm đẹp da" hoạt động rất tốt để tạo nhân vật.'],
    stylistFeatures: ['Thử bất kỳ trang phục nào trên người mẫu ngay lập tức.', 'Kết cấu và độ rủ của vải chân thực.', 'Duy trì danh tính và tư thế của người mẫu.'],
    stylistGuide: ['1. Tải lên ảnh toàn thân của người mẫu.', '2. Tải lên ảnh rõ nét của trang phục.', '3. Chọn một preset liên quan đến thời trang.', '4. (Tùy chọn) Chỉ định loại vải trong prompt.', '5. Nhấn "Tạo ảnh"!'],
    stylistTips: ['Sử dụng ảnh chụp chính diện, rõ nét của cả người mẫu và trang phục.', 'Nền đơn giản hoạt động tốt nhất cho cả hai hình ảnh.', 'Đảm bảo ảnh trang phục hiển thị toàn bộ món đồ.'],
    architectFeatures: ['Biến phác thảo 2D thành ảnh render 3D chân thực.', 'Hỗ trợ thiết kế nội thất và ngoại thất.', 'Ánh sáng điện ảnh và vật liệu chất lượng cao.'],
    architectGuide: ['1. Tải lên bản thiết kế hoặc phác thảo kiến trúc.', '2. Chọn một preset phù hợp (VD: Ngoại thất, Nội thất).', '3. Dùng prompt để chỉ định vật liệu, thời gian trong ngày và tâm trạng.', '4. (Tùy chọn) Dùng prompt tiêu cực để tránh hình ảnh trông như hoạt hình.', '5. Nhấn "Tạo ảnh"!'],
    architectTips: ['Bản vẽ có đường nét sạch, độ tương phản cao hoạt động tốt nhất.', 'Chỉ định vật liệu như "sàn gỗ sồi", "tường bê tông".', 'Về ánh sáng, hãy thử các prompt như "ánh sáng giờ vàng" hoặc "ánh sáng buổi sáng dịu nhẹ".'],
    magicFeatures: ['Cải thiện ảnh chỉ với một cú nhấp.', 'Kết hợp nhiều hiệu ứng như làm đẹp, phục chế, và nâng cấp.', 'AI tiên tiến đảm bảo nhận dạng của chủ thể được bảo toàn hoàn hảo.'],
    magicGuide: ['1. Tải lên ảnh bạn muốn chỉnh sửa.', '2. Bật các tính năng bạn muốn áp dụng (VD: Làm đẹp, Phục chế).', '3. Đảm bảo "Giữ nguyên đường nét" được bật cho ảnh chân dung.', '4. Nhấn "Tạo ảnh" để xem điều kỳ diệu!'],
    magicTips: ['Hoạt động tốt nhất với ảnh có một chủ thể chính.', 'Tính năng "Phục chế" rất mạnh mẽ cho ảnh gia đình được quét.', 'Nâng cấp có thể tăng chi tiết đáng kể, nhưng có thể mất thêm chút thời gian.'],
    backgroundFeatures: ['Xóa nền chỉ bằng một cú nhấp chuột.', 'Xuất ra file PNG độ phân giải cao với nền trong suốt.', 'Hoàn hảo cho ảnh sản phẩm, chân dung, và nhiều hơn nữa.'],
    backgroundGuide: ['1. Tải lên hình ảnh bạn muốn chỉnh sửa.', '2. Nhấp vào "Tạo ảnh"!', '3. Tải xuống hình ảnh của bạn với nền trong suốt.'],
    backgroundTips: ['Sử dụng hình ảnh có chủ thể rõ ràng để có kết quả tốt nhất.', 'Đầu ra là file PNG, hoàn hảo để đặt trên nền mới.', 'Ảnh đầu vào có độ phân giải cao sẽ tạo ra ảnh đầu ra có độ phân giải cao.'],
    // Video Tool
    generateVideo: 'Tạo Video',
    generatingVideo: 'Đang tạo Video...',
    videoResult: 'Kết quả Video',
    generationMode: 'Chế độ tạo',
    textToVideo: 'Văn bản thành Video',
    imageToVideo: 'Ảnh thành Video',
    videoWillAppear: 'Video được tạo của bạn sẽ xuất hiện ở đây.',
    videoInProgress: 'Đang tạo video...',
    videoInProgressCompose: 'Bước 1: Dựng bối cảnh...||Bước 2: Tạo video...',
    videoTakesTime: 'Quá trình này có thể mất vài phút.',
    videoAspectRatio: 'Tỷ lệ Khung hình',
    videoQuality: 'Chất lượng',
    portrait: '9:16 (Dọc)',
    landscape: '16:9 (Ngang)',
    hd720: '720p (HD)',
    hd1080: '1080p (Full HD)',
    videoPromptRequired: 'Vui lòng nhập mô tả cho video.',
    videoImageRequired: 'Vui lòng tải lên hình ảnh cho chế độ Ảnh thành Video.',
    videoImageRequiredBoth: 'Vui lòng tải lên cả ảnh Nhân vật và Bối cảnh.',
    videoAspectSquare: '1:1 (Vuông)',
    // Magic Tool
    magicBeautify: 'Làm đẹp da',
    magicBeautifyDesc: 'Làm mịn da, xóa mụn và khuyết điểm.',
    magicRestore: 'Phục chế ảnh cũ',
    magicRestoreDesc: 'Sửa ảnh mờ, vết xước, và màu bị phai.',
    magicUpscale: 'Nâng cấp phân giải',
    magicUpscaleDesc: 'Tăng kích thước và độ nét của ảnh.',
    preserveIdentity: 'Giữ nguyên đường nét',
    preserveIdentityDesc: 'Tuyệt đối giữ lại các đặc điểm khuôn mặt gốc.',
    errorNoMagicFeature: 'Vui lòng chọn ít nhất một tính năng ma thuật.',
  },
};

// --- API Context ---
interface IApiContext {
    ai: GoogleGenAI | null;
    apiKey: string;
    setAndStoreApiKey: (key: string) => void;
    isKeySet: boolean;
}

const ApiContext = createContext<IApiContext | null>(null);

const useApi = () => {
    const context = useContext(ApiContext);
    if (!context) {
        throw new Error("useApi must be used within an ApiProvider");
    }
    return context;
};

const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini-api-key') || '');
    
    const setAndStoreApiKey = useCallback((key: string) => {
        setApiKey(key);
        if (key) {
            localStorage.setItem('gemini-api-key', key);
        } else {
            localStorage.removeItem('gemini-api-key');
        }
    }, []);

    const ai = useMemo(() => {
        if (apiKey) {
            try {
                return new GoogleGenAI({ apiKey });
            } catch (e) {
                console.error("Failed to initialize GoogleGenAI:", e);
                return null;
            }
        }
        return null;
    }, [apiKey]);
    
    const contextValue = useMemo(() => ({
        ai,
        apiKey,
        setAndStoreApiKey,
        isKeySet: !!apiKey,
    }), [ai, apiKey, setAndStoreApiKey]);

    return (
        <ApiContext.Provider value={contextValue}>
            {children}
        </ApiContext.Provider>
    );
};

// --- Gemini API Service ---
class ApiAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiAuthError';
    }
}

const isAuthError = (err: any): boolean => {
    const message = (err.message || '').toLowerCase();
    const status = err.status || err.cause?.status;
    return (
        message.includes('api key not valid') ||
        message.includes('permission denied') ||
        message.includes('429') ||
        status === 400 ||
        status === 403 ||
        status === 429
    );
};

const callApi = async (apiLogic: () => Promise<any>) => {
    try {
        return await apiLogic();
    } catch (err: any) {
        if (isAuthError(err)) {
            throw new ApiAuthError('API request failed. Please check your API key and quota.');
        }
        throw err;
    }
};

const translateText = async (ai: GoogleGenAI, text: string, sourceLang: string, targetLang: string): Promise<string> => {
    const systemInstruction = `You are an expert translator. You will be given text in ${sourceLang}. Your task is to translate it to ${targetLang}. Respond with only the translated text, without any additional explanations, introductions, or conversational phrases.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: text,
        config: {
            systemInstruction,
            temperature: 0.1,
        },
    });
    
    return response.text.trim();
};

const generateImage = async (ai: GoogleGenAI, parts: any[]) => {
  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
  });

  const content = response?.candidates?.[0]?.content;
  if (!content || !content.parts || content.parts.length === 0) {
    const blockReason = response?.promptFeedback?.blockReason;
    if (blockReason) {
        throw new Error(`Image generation failed due to: ${blockReason}. Please modify your prompt or images.`);
    }
    throw new Error("Image generation failed. The prompt may have been blocked by safety settings or the API returned an empty response. Please try again.");
  }

  for (const part of content.parts) {
      if (part.inlineData && part.inlineData.data && part.inlineData.data.length > 200) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
  }
  throw new Error("No valid image found in response. The result may have been empty or blocked by safety settings.");
};

const generateImageFromText = async (ai: GoogleGenAI, prompt: string, negativePrompt: string, config: {aspectRatio: string, outputMimeType: OutputFormat}) => {
    const fullPrompt = `${prompt} ${negativePrompt ? ` | Negative: ${negativePrompt}` : ''}`;
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: fullPrompt,
        config: {
            numberOfImages: 1,
            outputMimeType: config.outputMimeType || 'image/jpeg',
            aspectRatio: config.aspectRatio && config.aspectRatio !== 'auto' ? config.aspectRatio : '1:1',
        },
    });

    if (response.generatedImages && response.generatedImages[0]) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:${config.outputMimeType || 'image/jpeg'};base64,${base64ImageBytes}`;
    }
    
    throw new Error("No image found in text-to-image response");
};

const generateVideo = async (ai: GoogleGenAI, apiKey: string, prompt: string, imagePart: UploadedImage['apiPayload'] | null = null, quality: VideoQuality, aspectRatio: VideoAspectRatio) => {
    const request: any = {
        model: 'veo-2.0-generate-001',
        prompt,
        config: { numberOfVideos: 1, quality, aspectRatio },
        ...(imagePart && {
            image: {
                imageBytes: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
            },
        }),
    };
    
    let operation = await ai.models.generateVideos(request);
    
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
    }

    if (operation.error) {
        console.error("Video generation operation failed:", operation.error);
        throw new Error(`Video generation failed: ${operation.error.message || 'Unknown API error'}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation failed or no URI returned.");
    }
    
    const response = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Failed to download video:", response.status, errorBody);
        throw new Error(`Failed to download video file. Status: ${response.status}`);
    }
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};

const getImageDimensions = (dataUrl: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = (err) => {
            reject(new Error("Failed to load image for dimension calculation."));
        };
        img.src = dataUrl;
    });
};

const resizeImageToAspectRatio = (imageData: UploadedImage, targetAspectRatio: string): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
        const [w, h] = targetAspectRatio.split(':').map(Number);
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
            console.warn(`Invalid aspect ratio: ${targetAspectRatio}. Returning original image.`);
            return resolve(imageData);
        }
        const targetRatio = w / h;

        const img = new Image();
        img.onload = () => {
            const originalRatio = img.width / img.height;
            if (Math.abs(originalRatio - targetRatio) < 0.01) {
                return resolve(imageData);
            }

            let canvasWidth = img.width;
            let canvasHeight = img.height;
            if (originalRatio > targetRatio) {
                canvasHeight = img.width / targetRatio;
            } else {
                canvasWidth = img.height * targetRatio;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(canvasWidth);
            canvas.height = Math.round(canvasHeight);
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));

            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, (canvas.width - img.width) / 2, (canvas.height - img.height) / 2);

            const newDataUrl = canvas.toDataURL(imageData.apiPayload.inlineData.mimeType);
            const newBase64String = newDataUrl.split(',')[1];
            
            resolve({
                dataUrl: newDataUrl,
                apiPayload: {
                    inlineData: {
                        data: newBase64String,
                        mimeType: imageData.apiPayload.inlineData.mimeType,
                    },
                },
            });
        };
        img.onerror = () => reject(new Error("Failed to load image for resizing."));
        img.src = imageData.dataUrl;
    });
};


// --- App Context ---
// Fix: Define helper types to create an overloaded signature for the translation function.
type TranslationsType = typeof TRANSLATIONS['en'];
type ArrayTranslationKeys = { [K in keyof TranslationsType]: TranslationsType[K] extends string[] ? K : never }[keyof TranslationsType];
type StringTranslationKeys = Exclude<keyof TranslationsType, ArrayTranslationKeys>;

interface IAppContext {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    openApiKeyModal: () => void;
    // Fix: Update the 't' function signature to be overloaded, providing type safety for string and string[] return types.
    t: {
        (key: ArrayTranslationKeys): string[];
        (key: StringTranslationKeys): string;
        (key: string): string | string[]; // Fallback for dynamic keys
    };
}
const AppContext = createContext<IAppContext | null>(null);
const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
};

// --- UI Components ---
const ApiKeyModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { apiKey, setAndStoreApiKey } = useApi();
    const { t } = useAppContext();
    const [localKey, setLocalKey] = useState(apiKey);
    const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalKey(apiKey);
        setCheckStatus('idle');
    }, [apiKey, isOpen]);
    
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleCheckKey = async () => {
        const keyToCheck = localKey.trim();
        if (!keyToCheck) return;
        setCheckStatus('checking');
        try {
            const testAi = new GoogleGenAI({ apiKey: keyToCheck });
            await testAi.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
            setCheckStatus('valid');
        } catch (error) {
            console.error("API Key check failed:", error);
            setCheckStatus('invalid');
        }
    };
    
    const handleSave = () => {
        setAndStoreApiKey(localKey);
        onClose();
    };

    const handleDelete = () => {
        setAndStoreApiKey('');
        setLocalKey('');
    };

    const getStatusMessage = () => {
        switch (checkStatus) {
            case 'checking': return <p className="text-sm text-yellow-500 mt-2">{t('checkingKey')}</p>;
            case 'valid': return <p className="text-sm text-green-500 mt-2">{t('keyValid')}</p>;
            case 'invalid': return <p className="text-sm text-red-500 mt-2">{t('keyInvalid')}</p>;
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true">
            <div ref={modalRef} className="bg-light-surface dark:bg-dark-surface p-6 rounded-2xl shadow-xl w-full max-w-md border border-light-border dark:border-dark-border">
                <h2 className="text-xl font-bold mb-2 text-light-text dark:text-dark-text">{t('enterApiKey')}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('apiKeyInstructions')} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-light-primary dark:text-dark-primary underline">{t('getApiKey')}</a></p>
                
                <input 
                    type="password"
                    value={localKey}
                    onChange={(e) => {
                        setLocalKey(e.target.value);
                        setCheckStatus('idle');
                    }}
                    placeholder="AIzaSy..."
                    className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text mb-2 focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary outline-none"
                    aria-label={t('apiKey')}
                />
                <div className="min-h-[24px]">
                    {getStatusMessage()}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2">
                    <button onClick={handleCheckKey} className="w-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-light-text dark:text-dark-text font-semibold py-2 px-4 rounded-lg transition-colors">{t('checkKey')}</button>
                    <button onClick={handleSave} className="w-full btn-primary text-white font-semibold py-2 px-4 rounded-lg">{t('saveKey')}</button>
                    <button onClick={handleDelete} className="w-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-light-text dark:text-dark-text font-semibold py-2 px-4 rounded-lg transition-colors">{t('deleteKey')}</button>
                </div>
                <div className="mt-2">
                     <button onClick={onClose} className="w-auto bg-transparent hover:bg-gray-200 dark:hover:bg-gray-600 text-light-text dark:text-dark-text font-semibold py-2 px-4 rounded-lg transition-colors">{t('cancel')}</button>
                </div>
            </div>
        </div>
    );
};


const Header = ({ onApiKeyClick }: { onApiKeyClick: () => void }) => {
  const { theme, setTheme, language, setLanguage, t } = useAppContext();
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <header className="bg-light-surface dark:bg-dark-surface shadow-md p-4 flex justify-between items-center border-b border-light-border dark:border-dark-border">
      <h1 className="text-xl font-bold text-light-text dark:text-dark-text">✨ {t('appName')}</h1>
      <div className="flex items-center space-x-2 md:space-x-4">
        <button onClick={toggleTheme} title={t('toggleTheme')} className="text-light-text dark:text-dark-text text-xl">
          <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
         </button>
        <div className="relative">
          <i className="fa-solid fa-globe text-light-text dark:text-dark-text absolute top-1/2 left-3 -translate-y-1/2"></i>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="pl-9 pr-4 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
            aria-label={t('language')}
          >
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>
        <button onClick={onApiKeyClick} className="btn-primary text-white font-bold py-2 px-4 rounded-lg text-sm">{t('apiKey')}</button>
      </div>
    </header>
  );
};

const Spinner = () => (
  <div className="flex justify-center items-center h-full">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-light-primary dark:border-dark-primary"></div>
   </div>
);

const ImageUploader = ({ onImageUpload, label }: {onImageUpload: (image: UploadedImage) => void, label: string}) => {
  const [image, setImage] = useState<string | null>(null);
  const { t } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64String = reader.result.split(',')[1];
          setImage(reader.result);
          onImageUpload({
            apiPayload: {
              inlineData: {
                data: base64String,
                mimeType: file.type,
              },
            },
            dataUrl: reader.result,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => fileInputRef.current?.click();

  return (
    <div>
      <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{label}</label>
      <div
        className={`image-upload-box w-full border-2 border-dashed border-light-border dark:border-dark-border rounded-lg text-center p-4 cursor-pointer hover:bg-light-bg dark:hover:bg-dark-bg ${!image ? 'h-48 flex flex-col items-center justify-center' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {image ? (
          <img src={image} alt="Uploaded preview" className="max-w-full h-auto rounded-md" />
        ) : (
          <>
            <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
            <p className="text-gray-500 dark:text-gray-400">{t('dragOrClick')}</p>
          </>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};

const ImageComparator = ({ beforeSrc, afterSrc }: { beforeSrc: string, afterSrc: string }) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMove = useCallback((clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        let position = (x / rect.width) * 100;
        position = Math.max(0, Math.min(100, position));
        setSliderPosition(position);
    }, []);

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleEnd = useCallback(() => {
        setIsDragging(false);
    }, []);
    
    const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        handleMove(clientX);
    }, [isDragging, handleMove]);

    useEffect(() => {
        window.addEventListener('mousemove', handleDrag);
        window.addEventListener('touchmove', handleDrag);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('touchmove', handleDrag);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [handleDrag, handleEnd]);

    return (
        <div ref={containerRef} className="image-comparator select-none">
            <img src={beforeSrc} alt="Before" className="comparator-img-before" draggable="false" />
            <div className="comparator-after" style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}>
                <img src={afterSrc} alt="After" className="comparator-img-after" draggable="false" />
            </div>
            <div 
                className="comparator-slider" 
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={handleStart}
                onTouchStart={handleStart}
            >
                <div className="comparator-handle">
                    <i className="fas fa-arrows-alt-h text-white"></i>
                </div>
            </div>
        </div>
    );
};

const ToolCard = ({ icon, title, description, onClick }: {icon: string, title: string, description: string, onClick: () => void}) => (
  <div
    className="bg-light-surface dark:bg-dark-surface p-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1.5 transition-all duration-300 cursor-pointer border border-light-border dark:border-dark-border"
    onClick={onClick}
  >
    <div className="text-2xl text-light-primary dark:text-dark-primary mb-4">
        <i className={`fas ${icon}`}></i>
      </div>
    <h3 className="text-xl font-bold mb-2 text-light-text dark:text-dark-text">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400">{description}</p>
  </div>
);

const ToolInfo = ({ toolKey }: {toolKey: string}) => {
    const { t } = useAppContext();
    const [activeTab, setActiveTab] = useState('features');

    // Fix: Add a helper to safely get array content from the 't' function, which can return string | string[].
    const getArrayContent = (key: string): string[] => {
        const result = t(key as any);
        return Array.isArray(result) ? result : [];
    }

    const contentForTab: {[key: string]: string[]} = {
        features: getArrayContent(`${toolKey}Features`),
        guide: getArrayContent(`${toolKey}Guide`),
        tips: getArrayContent(`${toolKey}Tips`),
    };
    
    const tabs = [
        { id: 'features', label: t('features'), icon: 'fa-star' },
        { id: 'guide', label: t('guide'), icon: 'fa-book-open' },
        { id: 'tips', label: t('tips'), icon: 'fa-lightbulb' },
    ];
    
    const currentContent = contentForTab[activeTab] || contentForTab['features'];

    return (
        <div className="mb-6">
            <div className="flex border-b-2 border-light-bg dark:border-dark-bg">
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-3 px-2 text-sm font-semibold flex items-center justify-center transition-colors duration-200 border-b-2 ${activeTab === tab.id ? 'border-light-primary dark:border-dark-primary text-light-primary dark:text-dark-primary' : 'border-transparent text-gray-500 hover:text-light-text dark:hover:text-dark-text'}`}
                    >
                        <i className={`fas ${tab.icon} mr-2`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="py-4 text-sm text-light-text dark:text-dark-text">
                <ul className="list-disc pl-5 space-y-1">
                    {Array.isArray(currentContent) && currentContent.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            </div>
        </div>
    );
};

interface ToggleSwitchProps {
    id: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    label: string;
    description?: string;
}

const ToggleSwitch = ({ id, checked, onChange, disabled, label, description }: ToggleSwitchProps) => (
    <div className="flex items-center justify-between bg-light-bg dark:bg-dark-bg p-3 rounded-lg border border-light-border dark:border-dark-border">
        <div>
            <label htmlFor={id} className="block text-sm font-bold text-light-text dark:text-dark-text cursor-pointer select-none">{label}</label>
            {description && <p className="text-xs text-gray-500 select-none">{description}</p>}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                id={id}
                checked={checked}
                onChange={onChange}
                className="sr-only peer"
                disabled={disabled}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
        </label>
    </div>
);


// --- Pages ---
const HomePage = ({ onNavigate }: {onNavigate: (page: Page) => void}) => {
  const { t } = useAppContext();
  const tools = [
    // Fix: Cast results of `t` function to `string` to match ToolCard prop types.
    { page: 'pose', icon: 'fa-street-view', title: t('poseStudioTitle') as string, desc: t('poseStudioDesc') as string },
    { page: 'prop', icon: 'fa-magic', title: t('propFusionTitle') as string, desc: t('propFusionDesc') as string },
    { page: 'design', icon: 'fa-palette', title: t('designStudioTitle') as string, desc: t('designStudioDesc') as string },
    { page: 'creative', icon: 'fa-lightbulb', title: t('creativeStudioTitle') as string, desc: t('creativeStudioDesc') as string },
    { page: 'stylist', icon: 'fa-tshirt', title: t('stylistStudioTitle') as string, desc: t('stylistStudioDesc') as string },
    { page: 'architect', icon: 'fa-drafting-compass', title: t('architectStudioTitle') as string, desc: t('architectStudioDesc') as string },
    { page: 'video', icon: 'fa-video', title: t('videoStudioTitle') as string, desc: t('videoStudioDesc') as string },
    { page: 'magic', icon: 'fa-wand-magic-sparkles', title: t('magicStudioTitle') as string, desc: t('magicStudioDesc') as string },
    { page: 'background', icon: 'fa-eraser', title: t('backgroundStudioTitle') as string, desc: t('backgroundStudioDesc') as string },
  ];

  return (
    <div className="p-8 animate-fade-in">
      <div className="text-center mb-12">
        <h2 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-fuchsia-500 to-purple-600 bg-clip-text text-transparent">{t('homeTitle')}</h2>
        <p className="text-xl text-gray-500 dark:text-gray-300 max-w-2xl mx-auto">{t('homeSubtitle')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tools.map((tool) => (
          <ToolCard
            key={tool.page}
            icon={tool.icon}
            title={tool.title}
            description={tool.desc}
            onClick={() => onNavigate(tool.page as Page)}
          />
        ))}
      </div>
    </div>
  );
};

const PoseStudio = ({ onBack }: { onBack: () => void }) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet } = useApi();
    const [characterImage, setCharacterImage] = useState<UploadedImage | null>(null);
    const [poseImage, setPoseImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [preset, setPreset] = useState(Object.keys(PRESETS)[0]);
    const [beauty, setBeauty] = useState<'on' | 'off'>(PRESETS[preset].beauty);
    const [controlMode, setControlMode] = useState<ControlMode>('Pose');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setBeauty(PRESETS[preset].beauty);
    }, [preset]);

    const isBeautyAvailable = useMemo(() => PRESETS[preset].beauty === 'on', [preset]);

    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        if (!characterImage || !poseImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên cả hai hình ảnh.' : 'Please upload both images.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { aspect: aspectRatio, beauty });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Control Mode: ${controlMode}
                Output-Format: ${outputFormat.split('/')[1]}
            `;

            const parts = [
                characterImage.apiPayload,
                poseImage.apiPayload,
                { text: finalPrompt },
            ];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="pose" />
                    <ImageUploader label={t('uploadCharacter')} onImageUpload={setCharacterImage} />
                    <ImageUploader label={t('uploadPose')} onImageUpload={setPoseImage} />
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (
                                <option key={key} value={key}>{value.label[language as Language]}</option>
                            ))}
                        </select>
                    </div>

                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-pose" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                            {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="beautify-toggle-pose"
                                checked={beauty === 'on'} 
                                onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} 
                                className="sr-only peer" 
                                disabled={!isBeautyAvailable}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('controlMode')}</label>
                        <div className="flex space-x-2 rounded-lg p-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                            {CONTROL_MODES.map((mode) => (
                                <button
                                key={mode}
                                onClick={() => setControlMode(mode)}
                                className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                    controlMode === mode
                                    ? 'btn-primary text-white'
                                    : 'bg-transparent text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-surface'
                                }`}
                                >
                                {t(`controlMode${mode}`)}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400 min-h-[2.5em] px-1">
                          {t(`controlModeDesc_${controlMode}` as any)}
                        </p>
                    </div>

                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea
                          id="positivePrompt"
                          value={positivePrompt}
                          onChange={(e) => setPositivePrompt(e.target.value)}
                          placeholder={t('positivePromptPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea
                          id="negativePrompt"
                          value={negativePrompt}
                          onChange={(e) => setNegativePrompt(e.target.value)}
                          placeholder={t('negativePromptPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && characterImage ? <ImageComparator beforeSrc={characterImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIStylist = ({ onBack }: {onBack: () => void}) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet } = useApi();
    const [modelImage, setModelImage] = useState<UploadedImage | null>(null);
    const [outfitImage, setOutfitImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState(() => t('stylistPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('stylistNegativeDefault'));
    const [preset, setPreset] = useState('auto-preset');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [beauty, setBeauty] = useState<'on'|'off'>('on');
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['stylistPositiveDefault']
                    ? t('stylistPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['stylistNegativeDefault']
                    ? t('stylistNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);

    useEffect(() => {
        if (preset !== 'auto-preset') {
            setBeauty(PRESETS[preset].beauty);
        } else {
            setBeauty('on');
        }
    }, [preset]);

    const isBeautyAvailable = useMemo(() => preset === 'auto-preset' || PRESETS[preset]?.beauty === 'on', [preset]);
    
    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        if (!modelImage || !outfitImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên ảnh người mẫu và trang phục.' : 'Please upload both model and outfit images.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            let finalAspectRatio = aspectRatio;
            if (aspectRatio === 'auto') {
                if (modelImage?.dataUrl) {
                    try {
                        const { width, height } = await getImageDimensions(modelImage.dataUrl);
                        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
                        const divisor = gcd(width, height);
                        finalAspectRatio = `${width / divisor}:${height / divisor}`;
                    } catch (e) {
                        console.error("Could not determine image aspect ratio, falling back.", e);
                        finalAspectRatio = (preset !== 'auto-preset' && PRESETS[preset].aspect) || '1:1';
                    }
                } else {
                    finalAspectRatio = (preset !== 'auto-preset' && PRESETS[preset].aspect) || '1:1';
                }
            }

            const imageToSend = await resizeImageToAspectRatio(modelImage, finalAspectRatio);
            
            let presetDirective;
            let userPromptInstruction;

            if (preset === 'auto-preset') {
                const quality = `[QUALITY] ${PRESET_CONTROLLER.quality_block}`;
                const global = `[GLOBAL] aspect=${finalAspectRatio}; pipeline=${PRESET_CONTROLLER.global_defaults.color_pipeline}; noise_floor=${PRESET_CONTROLLER.global_defaults.noise_floor}.`;
                const instruction = `[INSTRUCTION] Your primary goal is to EXACTLY replicate the photographic style, lighting, camera properties, and mood of the first input image. ${PRESET_CONTROLLER.generation_instruction}`;
                presetDirective = `${quality}\n\n${global}\n${instruction}`;
                
                userPromptInstruction = `
                    instruction: This is a virtual try-on task. The goal is to replace the clothing on the person in the first image (the model) with the outfit from the second image.

                    **ABSOLUTE CRITICAL INSTRUCTIONS:**
                    1.  **EXACTLY REPLICATE STYLE:** This is the most important rule. You must perfectly match the photographic style, lighting, mood, colors, and camera properties of the first input image.
                    2.  **STRICTLY PRESERVE COMPOSITION & IDENTITY:** The output image's framing, camera angle, zoom level, crop, and the person's pose, face, hair, and body MUST be an EXACT replica of the first input image.
                    3.  **DO NOT CHANGE THE SCENE:** Do not create a new background or change the existing one. If the input image was padded to fit the aspect ratio, the output must have identical padding.
                    4.  **SWAP OUTFIT ONLY:** Your ONLY task is to realistically place the new outfit onto the model.
                `;
            } else {
                presetDirective = buildPresetDirective(preset, { beauty, aspect: finalAspectRatio });
                userPromptInstruction = `
                    instruction: This is a virtual try-on task. The goal is to replace the clothing on the person in the first image (the model) with the outfit from the second image.

                    **ABSOLUTE CRITICAL INSTRUCTIONS:**
                    1.  **STRICTLY PRESERVE COMPOSITION & IDENTITY:** This is the most important rule. The output image's framing, camera angle, zoom level, crop, and the person's pose, face, hair, and body MUST be an EXACT replica of the first input image.
                    2.  **DO NOT CHANGE THE SCENE:** Do not create a new background or change the existing one. If the input image was padded to fit the aspect ratio, the output must have identical padding.
                    3.  **SWAP OUTFIT ONLY:** Your ONLY task is to realistically place the new outfit onto the model.

                    **Regarding the preset:** Use the preset's 'style', 'lighting', and 'mood' to influence the final aesthetic. HOWEVER, you MUST IGNORE any part of the preset that contradicts the critical instructions above (e.g., ignore 'full-body shots' if the input is a close-up). The original composition is absolute.
                `;
            }
            
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                ${userPromptInstruction}
                
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;

            const parts = [
                imageToSend.apiPayload,
                outfitImage.apiPayload,
                { text: finalPrompt },
            ];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="stylist" />
                    <ImageUploader label={t('uploadModel')} onImageUpload={setModelImage} />
                    <ImageUploader label={t('uploadOutfit')} onImageUpload={setOutfitImage} />
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            <option value="auto-preset">{t('autoPreset')}</option>
                            {Object.entries(PRESETS).map(([key, value]) => (
                                <option key={key} value={key}>{value.label[language as Language]}</option>
                            ))}
                        </select>
                    </div>

                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-stylist" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                            {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="beautify-toggle-stylist"
                                checked={beauty === 'on'} 
                                onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} 
                                className="sr-only peer" 
                                disabled={!isBeautyAvailable}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>

                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea
                          id="positivePrompt"
                          value={positivePrompt}
                          onChange={(e) => setPositivePrompt(e.target.value)}
                          placeholder={t('positivePromptPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea
                          id="negativePrompt"
                          value={negativePrompt}
                          onChange={(e) => setNegativePrompt(e.target.value)}
                          placeholder={t('negativePromptPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                            {isLoading ? (
                                <Spinner />
                            ) : resultImage ? (
                                <img src={resultImage} alt={t('result')} className="object-contain max-h-full max-w-full rounded-lg" />
                            ) : (
                                <p className="text-gray-500">{t('preview')}</p>
                            )}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PropFusion = ({ onBack }: {onBack: () => void}) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet } = useApi();
    const [characterImage, setCharacterImage] = useState<UploadedImage | null>(null);
    const [propImage, setPropImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState(() => t('propFusionPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('propFusionNegativeDefault'));
    const [preset, setPreset] = useState('portrait-studio');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [beauty, setBeauty] = useState<'on' | 'off'>(PRESETS[preset].beauty);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string|null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['propFusionPositiveDefault']
                    ? t('propFusionPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['propFusionNegativeDefault']
                    ? t('propFusionNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);

    useEffect(() => {
        setBeauty(PRESETS[preset].beauty);
    }, [preset]);

    const isBeautyAvailable = useMemo(() => PRESETS[preset].beauty === 'on', [preset]);

    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        if (!characterImage || !propImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên ảnh nhân vật và đạo cụ.' : 'Please upload both character and prop images.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { beauty, aspect: aspectRatio });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: Seamlessly and realistically integrate the object from the second image (prop) into the first image (character/scene). Match the lighting, shadows, and perspective.
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            const parts = [characterImage.apiPayload, propImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="prop" />
                    <ImageUploader label={t('uploadCharacter')} onImageUpload={setCharacterImage} />
                    <ImageUploader label={t('uploadProp')} onImageUpload={setPropImage} />
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>

                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-prop" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                            {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="beautify-toggle-prop"
                                checked={beauty === 'on'} 
                                onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} 
                                className="sr-only peer" 
                                disabled={!isBeautyAvailable}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>

                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('positivePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && characterImage ? <ImageComparator beforeSrc={characterImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIDesign = ({ onBack }: {onBack: () => void}) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet } = useApi();
    const [subjectImage, setSubjectImage] = useState<UploadedImage | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState(() => t('designPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('designNegativeDefault'));
    const [preset, setPreset] = useState('art-fantasy');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [beauty, setBeauty] = useState<'on' | 'off'>(PRESETS[preset].beauty);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['designPositiveDefault']
                    ? t('designPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['designNegativeDefault']
                    ? t('designNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);

    useEffect(() => {
        setBeauty(PRESETS[preset].beauty);
    }, [preset]);

    const isBeautyAvailable = useMemo(() => PRESETS[preset].beauty === 'on', [preset]);

    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        if (!subjectImage || !backgroundImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên cả ảnh chủ thể và ảnh nền.' : 'Please upload both subject and background images.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { beauty, aspect: aspectRatio });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: Place the subject from the first image into the background of the second image. The final image should be a cohesive and high-quality artistic composition that blends the subject and background seamlessly according to the preset style.
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            const parts = [subjectImage.apiPayload, backgroundImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="design" />
                    <ImageUploader label={t('uploadSubject')} onImageUpload={setSubjectImage} />
                    <ImageUploader label={t('uploadBackground')} onImageUpload={setBackgroundImage} />
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-design" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                            {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="beautify-toggle-design"
                                checked={beauty === 'on'} 
                                onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} 
                                className="sr-only peer" 
                                disabled={!isBeautyAvailable}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>

                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('positivePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && subjectImage ? <ImageComparator beforeSrc={subjectImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AICreative = ({ onBack }: {onBack: () => void}) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet } = useApi();
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState(() => t('creativeNegativeDefault'));
    const [preset, setPreset] = useState('art-fantasy');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [beauty, setBeauty] = useState<'on' | 'off'>(PRESETS[preset].beauty);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['creativeNegativeDefault']
                    ? t('creativeNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);

    useEffect(() => {
        setBeauty(PRESETS[preset].beauty);
    }, [preset]);

    const isBeautyAvailable = useMemo(() => PRESETS[preset].beauty === 'on', [preset]);
    
    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        if (!positivePrompt.trim()) {
            setError(language === 'vi' ? 'Vui lòng nhập mô tả cho ảnh.' : 'Please enter an image prompt.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }
            
            const presetDirective = buildPresetDirective(preset, { beauty, aspect: 'auto' });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                Positive: ${finalPositivePrompt}
            `;
            const config = { aspectRatio, outputMimeType: outputFormat };
            
            const generatedImage = await callApi(() => generateImageFromText(ai, finalPrompt, finalNegativePrompt, config));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="creative" />
                    <div>
                        <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('imagePrompt')}</label>
                        <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('imagePromptPlaceholder')} rows={5} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.filter(r => r.value !== 'auto').map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-creative" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                             {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="beautify-toggle-creative" checked={beauty === 'on'} onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} className="sr-only peer" disabled={!isBeautyAvailable} />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage ? <img src={resultImage} alt="Generated result" className="object-contain max-h-full max-w-full rounded-lg" /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIArchitect = ({ onBack }: {onBack: () => void}) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet } = useApi();
    const [blueprintImage, setBlueprintImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState(() => t('architectPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('architectNegativeDefault'));
    const [preset, setPreset] = useState('architecture-exterior');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['architectPositiveDefault']
                    ? t('architectPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['architectNegativeDefault']
                    ? t('architectNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);
    
    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        if (!blueprintImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên bản thiết kế.' : 'Please upload a blueprint image.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { aspect: aspectRatio });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: Transform the input architectural sketch/blueprint into a photorealistic render.
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            const parts = [blueprintImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="architect" />
                    <ImageUploader label={t('uploadBlueprint')} onImageUpload={setBlueprintImage} />
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).filter(([key]) => key.startsWith('architecture-')).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>
                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('positivePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && blueprintImage ? <ImageComparator beforeSrc={blueprintImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIVideoCreator = ({ onBack }: {onBack: () => void}) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet, apiKey } = useApi();
    const [mode, setMode] = useState<VideoGenerationMode>('text');
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<UploadedImage | null>(null);
    const [contextImage, setContextImage] = useState<UploadedImage | null>(null);
    const [quality, setQuality] = useState<VideoQuality>('720p');
    const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
    const [isLoading, setIsLoading] = useState(false);
    const [resultVideo, setResultVideo] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('');

    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        setError('');
        if (!prompt.trim()) {
            setError(t('videoPromptRequired'));
            return;
        }
        if (mode === 'image' && (!image || !contextImage)) {
            setError(t('videoImageRequiredBoth'));
            return;
        }
        
        setIsLoading(true);
        setResultVideo(null);
        
        try {
            let finalPrompt = prompt;
            if (language === 'vi' && prompt.trim()) {
                finalPrompt = await callApi(() => translateText(ai, prompt, 'Vietnamese', 'English'));
            }

            let imageForVideoPayload: UploadedImage['apiPayload'] | null = null;
            if (mode === 'image' && image && contextImage) {
                setLoadingMessage(t('videoInProgressCompose').split('||')[0]);
                const composePrompt = {
                    text: `Take the character from the first image and place them realistically into the second image (the background/context). The final composed image should be a single, coherent scene.`,
                };
                const parts = [image.apiPayload, contextImage.apiPayload, composePrompt];
                const compositeImageDataUrl = await callApi(() => generateImage(ai, parts));
                
                const [header, base64Data] = compositeImageDataUrl.split(',');
                const mimeType = header.match(/:(.*?);/)![1];
                imageForVideoPayload = {
                    inlineData: { data: base64Data, mimeType },
                };
                
                setLoadingMessage(t('videoInProgressCompose').split('||')[1]);
            } else {
                 setLoadingMessage(t('generatingVideo'));
            }

            const videoUrl = await callApi(() => generateVideo(ai, apiKey, finalPrompt, imageForVideoPayload, quality, aspectRatio));
            setResultVideo(videoUrl);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('generationMode')}</label>
                        <div className="flex space-x-2 rounded-lg p-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                            <button onClick={() => setMode('text')} className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'text' ? 'btn-primary text-white' : 'bg-transparent text-light-text dark:text-dark-text'}`}>
                                {t('textToVideo')}
                            </button>
                            <button onClick={() => setMode('image')} className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'image' ? 'btn-primary text-white' : 'bg-transparent text-light-text dark:text-dark-text'}`}>
                                {t('imageToVideo')}
                            </button>
                        </div>
                    </div>

                    {mode === 'image' && (
                        <>
                           <ImageUploader label={t('uploadCharacter')} onImageUpload={setImage} />
                           <ImageUploader label={t('uploadContext')} onImageUpload={setContextImage} />
                        </>
                    )}

                    <div>
                      <label htmlFor="videoPrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('videoPrompt')}</label>
                      <textarea
                          id="videoPrompt"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder={t('videoPromptPlaceholder')}
                          rows={5}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('videoAspectRatio')}</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as VideoAspectRatio)}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
                            aria-label={t('videoAspectRatio')}
                        >
                            <option value="16:9">{t('landscape')}</option>
                            <option value="9:16">{t('portrait')}</option>
                            <option value="1:1">{t('videoAspectSquare')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('videoQuality')}</label>
                        <select
                            value={quality}
                            onChange={(e) => setQuality(e.target.value as VideoQuality)}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
                            aria-label={t('videoQuality')}
                        >
                            <option value="720p">{t('hd720')}</option>
                            <option value="1080p">{t('hd1080')}</option>
                        </select>
                    </div>

                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('videoResult')}</h3>
                         <div className="w-full aspect-video bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                            {isLoading ? (
                                <div className="text-center p-4">
                                    <Spinner />
                                    <p className="mt-4 font-semibold text-light-text dark:text-dark-text">{loadingMessage}</p>
                                    <p className="text-sm text-gray-500">{t('videoTakesTime')}</p>
                                </div>
                             ) : resultVideo ? (
                                 <video src={resultVideo} controls muted playsInline className="w-full h-full rounded-lg" />
                             ) : (
                                <p className="text-gray-500">{t('videoWillAppear')}</p>
                             )}
                         </div>
                         {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                    </div>
                    {resultVideo && !isLoading && (
                        <a href={resultVideo} download="generated-video.mp4" className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-film mr-2"></i> {isLoading ? t('generatingVideo') : t('generateVideo')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIMagic = ({ onBack }: {onBack: () => void}) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet } = useApi();
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    
    const [doBeautify, setDoBeautify] = useState(false);
    const [doRestore, setDoRestore] = useState(false);
    const [doUpscale, setDoUpscale] = useState(false);
    const [preserveIdentity, setPreserveIdentity] = useState(true);

    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    
    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        if (!sourceImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên ảnh gốc.' : 'Please upload the source image.');
            return;
        }

        const instructionParts = [];
        if (doBeautify) instructionParts.push("Beautify the subject: smooth skin, remove acne and blemishes, but keep it looking natural.");
        if (doRestore) instructionParts.push("Restore the photo: improve clarity, fix scratches, correct color fading, and reduce noise.");
        if (doUpscale) instructionParts.push("Upscale the image to a higher resolution, adding realistic details and textures.");

        const hasMagicToggles = instructionParts.length > 0;
        const hasPrompts = positivePrompt.trim() !== '' || negativePrompt.trim() !== '';

        if (!hasMagicToggles && !hasPrompts) {
            setError(t('errorNoMagicFeature'));
            return;
        }
        
        setIsLoading(true);
        setResultImage(null);
        setError('');
        
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }
            
            let instruction = hasMagicToggles
                ? `Perform the following image editing operations: ${instructionParts.join(' ')}. `
                : 'Edit the image based on the user\'s prompts. ';

            if (preserveIdentity) {
                instruction += "IMPORTANT: You must strictly preserve the person's unique facial features and identity. Do not alter the fundamental shape of the eyes, nose, mouth, or jaw. The person in the output must be perfectly recognizable as the person in the input.";
            }

            const presetDirective = buildPresetDirective('product-commercial', { aspect: aspectRatio });
            
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: ${instruction}
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            
            const parts = [sourceImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="magic" />
                    <ImageUploader label={t('uploadSourceImage')} onImageUpload={setSourceImage} />
                    
                    <div>
                        <label htmlFor="magic-positive-prompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                        <textarea
                            id="magic-positive-prompt"
                            value={positivePrompt}
                            onChange={(e) => setPositivePrompt(e.target.value)}
                            placeholder={t('positivePromptPlaceholder')}
                            rows={3}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                        />
                    </div>
                    <div>
                        <label htmlFor="magic-negative-prompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                        <textarea
                            id="magic-negative-prompt"
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder={t('negativePromptPlaceholder')}
                            rows={3}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                        />
                    </div>

                    <div className="space-y-4">
                        <ToggleSwitch
                            id="magic-beautify"
                            label={t('magicBeautify')}
                            description={t('magicBeautifyDesc')}
                            checked={doBeautify}
                            onChange={(e) => setDoBeautify(e.target.checked)}
                            disabled={isLoading}
                        />
                         <ToggleSwitch
                            id="magic-restore"
                            label={t('magicRestore')}
                            description={t('magicRestoreDesc')}
                            checked={doRestore}
                            onChange={(e) => setDoRestore(e.target.checked)}
                            disabled={isLoading}
                        />
                         <ToggleSwitch
                            id="magic-upscale"
                            label={t('magicUpscale')}
                            description={t('magicUpscaleDesc')}
                            checked={doUpscale}
                            onChange={(e) => setDoUpscale(e.target.checked)}
                            disabled={isLoading}
                        />
                        <hr className="border-light-border dark:border-dark-border" />
                         <ToggleSwitch
                            id="magic-preserve"
                            label={t('preserveIdentity')}
                            description={t('preserveIdentityDesc')}
                            checked={preserveIdentity}
                            onChange={(e) => setPreserveIdentity(e.target.checked)}
                            disabled={isLoading}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && sourceImage ? <ImageComparator beforeSrc={sourceImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-wand-magic-sparkles mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIBackground = ({ onBack }: {onBack: () => void}) => {
    const { t, language, openApiKeyModal } = useAppContext();
    const { ai, isKeySet } = useApi();
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!isKeySet || !ai) {
            openApiKeyModal();
            return;
        }
        if (!sourceImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên một hình ảnh.' : 'Please upload an image.');
            return;
        }
        
        setIsLoading(true);
        setResultImage(null);
        setError('');
        
        try {
            const finalPrompt = `
                **CRITICAL INSTRUCTION: BACKGROUND REMOVAL**

                Your ONLY task is to perfectly remove the background from the input image.

                **RULES:**
                1.  **IDENTIFY SUBJECT:** Accurately identify the main subject(s) of the image.
                2.  **PRECISE MASKING:** Create a clean, sharp, and precise mask around the subject(s).
                3.  **TRANSPARENT OUTPUT:** The output image MUST have a transparent background. The format should be PNG.
                4.  **PRESERVE SUBJECT:** You must NOT alter the subject in any way. Preserve all original details, textures, and colors of the subject.
                5.  **NO ADDITIONS:** Do not add any new background, shadows, outlines, or any other elements.

                The result should be only the original subject on a transparent canvas.
            `;
            
            const parts = [sourceImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="background" />
                    <ImageUploader label={t('uploadImage')} onImageUpload={setSourceImage} />
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border checkerboard-bg">
                             {isLoading ? <Spinner /> : resultImage && sourceImage ? <ImageComparator beforeSrc={sourceImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading || !sourceImage} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-eraser mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Footer = () => {
  return (
    <footer className="bg-light-surface dark:bg-dark-surface p-4 text-center border-t border-light-border dark:border-dark-border">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        ©2025 Bản quyền thuộc về Dương Tiến Dũng 📱0917 939 111
      </p>
    </footer>
  );
};


// --- Main App Component ---
const App = () => {
  const [page, setPage] = useState<Page>('home');
  const [theme, setTheme] = useState<Theme>('dark');
  const [language, setLanguage] = useState<Language>('vi');
  const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const { isKeySet } = useApi();

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(storedTheme as Theme);
    
    if (!isKeySet) {
        setApiKeyModalOpen(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Fix: Update 't' function to be correctly typed with an overloaded signature.
  const t = useCallback(
    ((key: string): string | string[] => {
      const typedKey = key as keyof TranslationsType;
      return TRANSLATIONS[language]?.[typedKey] || TRANSLATIONS['en'][typedKey] || key;
    }) as IAppContext['t'],
    [language]
  );

  const handleNavigate = (newPage: Page) => {
      setPage(newPage);
  };
  
  const contextValue = useMemo(() => ({
    theme,
    setTheme,
    language,
    setLanguage,
    t,
    openApiKeyModal: () => setApiKeyModalOpen(true),
  }), [theme, language, t]);

  const renderPage = () => {
    switch (page) {
      case 'pose':
        return <PoseStudio onBack={() => setPage('home')} />;
      case 'prop':
        return <PropFusion onBack={() => setPage('home')} />;
      case 'design':
        return <AIDesign onBack={() => setPage('home')} />;
      case 'creative':
        return <AICreative onBack={() => setPage('home')} />;
      case 'stylist':
        return <AIStylist onBack={() => setPage('home')} />;
      case 'architect':
        return <AIArchitect onBack={() => setPage('home')} />;
      case 'video':
        return <AIVideoCreator onBack={() => setPage('home')} />;
      case 'magic':
        return <AIMagic onBack={() => setPage('home')} />;
      case 'background':
        return <AIBackground onBack={() => setPage('home')} />;
      case 'home':
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className={`min-h-screen flex flex-col bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text transition-colors duration-300`}>
        <Header onApiKeyClick={() => setApiKeyModalOpen(true)} />
        <main className="flex-grow">{renderPage()}</main>
        <Footer />
        <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
      </div>
    </AppContext.Provider>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ApiProvider>
        <App />
    </ApiProvider>
  );
}
