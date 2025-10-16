import { GoogleGenAI, Modality } from '@google/genai'

// Gemini API key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBLmGV7kgxDjIjXVDZ6Y7QK3HyMQJZFKV0'

const ai = new GoogleGenAI({ apiKey: API_KEY })

interface GenerateModelOptions {
  prompt: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:5' | '2:3' | '3:2' | '3:4' | '4:3' | '5:4' | '21:9'
}

export const generateFashionModel = async (options: GenerateModelOptions): Promise<string> => {
  try {
    const { prompt, aspectRatio = '9:16' } = options
    
    // System instruction za fashion model
    const systemInstructionText = `You are an AI fashion model generator. Your task is to create photorealistic fashion models based on user descriptions. The models must be professional, high-quality, and suitable for fashion design and clothing presentation. Focus on editorial fashion photography style with professional lighting and clean backgrounds.`
    
    // Korisnikov prompt
    const enhancedPrompt = `${prompt}. Style: Editorial fashion photography, professional lighting, clean background, full body shot, fashion runway quality, high resolution, photorealistic.`
    
    console.log('Generating model with prompt:', enhancedPrompt)
    
    // API poziv prema ORIGINALNOJ sintaksi
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      system: { parts: [{ text: systemInstructionText }] },
      contents: { parts: [{ text: enhancedPrompt }] },
      config: {
        responseModalities: [Modality.IMAGE],
        imageConfig: {
          aspectRatio: aspectRatio,
          numberOfImages: 1
        }
      },
    })
    
    console.log('API Response:', response)
    
    // Pronalaženje slike u odgovoru
    const imagePart = response.candidates?.[0]?.content?.parts.find((part: any) => part.inlineData)
    
    if (imagePart?.inlineData) {
      const base64Image = imagePart.inlineData.data
      return `data:image/png;base64,${base64Image}`
    }
    
    throw new Error('No image generated in response')
    
  } catch (error: any) {
    console.error('Error generating fashion model:', error)
    throw new Error(error.message || 'Failed to generate fashion model. Please try again.')
  }
}

export const analyzeUploadedImage = async (imageFile: File): Promise<{
  description: string
  suggestions: string[]
}> => {
  try {
    // Konvertovanje slike u base64
    const base64Image = await fileToBase64(imageFile)
    
    const prompt = `Analyze this image for fashion modeling purposes. Describe the person's appearance, pose, and suitability for fashion modeling. Provide suggestions for how to best use this as a fashion model. Keep the response concise and professional.`
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { 
        parts: [
          { text: prompt },
          { 
            inlineData: {
              mimeType: imageFile.type,
              data: base64Image.split(',')[1]
            }
          }
        ]
      }
    })
    
    const text = response.candidates?.[0]?.content?.parts.find((part: any) => part.text)?.text || 'Analysis complete'
    
    return {
      description: text,
      suggestions: [
        'Consider professional lighting for best results',
        'Full body shots work best for fashion modeling',
        'Ensure clear, high-resolution images'
      ]
    }
    
  } catch (error: any) {
    console.error('Error analyzing image:', error)
    throw new Error(error.message || 'Failed to analyze image. Please try again.')
  }
}

export const generateModelFromUploadedImage = async (imageFile: File): Promise<string> => {
  try {
    // Konvertovanje slike u base64
    const base64Image = await fileToBase64(imageFile)
    
    console.log('Transforming uploaded image to model in swimwear with Gemini 2.5 Flash Image Preview...')
    
    const base64Data = base64Image.split(',')[1]
    const imagePart = { inlineData: { data: base64Data, mimeType: imageFile.type } }
    
    // Test prompt - samo promeni pozadinu u sivu
    const transformPrompt = `Change the background to solid gray. Keep everything else exactly the same.`
    
    const textPart = { text: transformPrompt }
    
    // API poziv sa image preview modelom koji podržava image input
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseModalities: [Modality.IMAGE],
        imageConfig: {
          aspectRatio: '9:16',
          numberOfImages: 1
        }
      }
    })
    
    console.log('API Response:', JSON.stringify(response, null, 2))
    
    // Pronalaženje slike - proveravam sve moguće strukture
    let imageData = null
    
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0]
      console.log('Candidate:', candidate)
      
      // Proveravam različite strukture odgovora
      if (candidate.content?.parts) {
        const imagePart = candidate.content.parts.find((part: any) => part.inlineData)
        if (imagePart?.inlineData) {
          imageData = imagePart.inlineData.data
        }
      }
      
      // Alternativna struktura
      if (!imageData && candidate.output?.inlineData) {
        imageData = candidate.output.inlineData.data
      }
      
      // Još jedna alternativa
      if (!imageData && candidate.image) {
        imageData = candidate.image
      }
    }
    
    console.log('Found image data:', imageData ? 'YES' : 'NO')
    
    if (imageData) {
      return `data:image/png;base64,${imageData}`
    }
    
    throw new Error('No image generated in response')
    
  } catch (error: any) {
    console.error('Error transforming image:', error)
    throw new Error(error.message || 'Failed to transform image. Please try again.')
  }
}

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

interface DressModelOptions {
  modelImageUrl: string
  clothingImages: File[]
  backgroundPrompt: string
}

export const generateDressedModel = async (options: DressModelOptions): Promise<string> => {
  try {
    const { modelImageUrl, clothingImages, backgroundPrompt } = options
    
    // Fetch the original model image
    const modelImageResponse = await fetch(modelImageUrl)
    const modelImageBlob = await modelImageResponse.blob()
    const modelImageFile = new File([modelImageBlob], 'model.png', { type: modelImageBlob.type })
    const modelImageBase64 = await fileToBase64(modelImageFile)
    
    // Convert clothing images to base64
    const clothingBase64Array = await Promise.all(
      clothingImages.map(file => fileToBase64(file))
    )
    
    // Build the prompt - EXPLICITLY state to use the SAME model from the first image
    const clothingDescription = clothingImages.length === 1 
      ? 'the clothing item shown'
      : `the ${clothingImages.length} clothing items shown`
    
    const prompt = `‼️ CRITICAL INSTRUCTION - THIS IS MANDATORY ‼️

YOU MUST USE THE EXACT SAME PERSON FROM THE FIRST IMAGE. 
DO NOT CREATE A NEW MODEL. DO NOT GENERATE A DIFFERENT PERSON.
DO NOT CHANGE THE MODEL'S IDENTITY IN ANY WAY.

TASK:
Take the EXACT model/person shown in the first image and dress them in ${clothingDescription} from the other image(s).

ABSOLUTE REQUIREMENTS (MUST FOLLOW):
1. ✅ USE THE SAME FACE from the first image - identical facial features, skin tone, ethnicity
2. ✅ USE THE SAME BODY from the first image - identical body type, proportions, posture
3. ✅ USE THE SAME PERSON from the first image - this person must be recognizable as the same individual
4. ✅ ONLY CHANGE: the clothing and the background
5. ✅ KEEP: everything else about the model identical

WHAT TO CHANGE:
- Clothing: Dress the model in ${clothingDescription}
- Background: ${backgroundPrompt}
- Lighting: Professional fashion photography lighting
- Pose: Natural fashion photography pose (full body, head to toes visible)

WHAT MUST STAY THE SAME:
- Face (100% identical)
- Body type (100% identical)  
- Skin tone (100% identical)
- Hair (same style and color)
- Ethnicity (100% identical)
- Gender (100% identical)
- Age (same appearance)
- Overall identity (same person)

OUTPUT REQUIREMENTS:
- High resolution, photorealistic quality
- Full body shot showing complete outfit
- Professional fashion photography style
- The model MUST be recognizably the SAME person from the first image

⚠️ REMINDER: This is the user's model. You MUST use their model. Do NOT create a different person. ⚠️`

    console.log('Generating dressed model with SAME model constraint')
    console.log('Model image URL:', modelImageUrl)
    console.log('Number of clothing images:', clothingImages.length)
    
    // Prepare parts for the API call - MODEL IMAGE FIRST (crucial!)
    const parts: any[] = [
      { text: prompt },
      // Add the original model image FIRST
      {
        inlineData: {
          mimeType: modelImageFile.type,
          data: modelImageBase64.split(',')[1]
        }
      }
    ]
    
    // Add clothing images AFTER the model image
    clothingBase64Array.forEach((base64Image, index) => {
      parts.push({
        inlineData: {
          mimeType: clothingImages[index].type,
          data: base64Image.split(',')[1]
        }
      })
    })
    
    // System instruction - EXTREMELY EXPLICIT
    const systemInstructionText = `You are an AI fashion stylist with ONE CRITICAL RULE: 

NEVER CREATE A NEW MODEL. NEVER GENERATE A DIFFERENT PERSON.

Your ONLY job is to take the EXACT person shown in the first image and change their clothing and background. This is NOT a request to create a similar-looking person. This is a REQUIREMENT to use the SAME EXACT person.

The person in the output image must be 100% IDENTICAL to the person in the first image:
- Same face (every facial feature identical)
- Same body (exact body type and proportions)
- Same skin tone
- Same ethnicity
- Same gender
- Same hair
- Same age appearance

You are ONLY allowed to change:
1. The clothing (apply new outfit)
2. The background (change setting)
3. The lighting and pose (for professional photography)

Everything else MUST remain IDENTICAL. The user selected a specific model from their database. You MUST use that exact model. Creating a different person is NOT acceptable and will be considered a failure.

IDENTITY PRESERVATION IS MANDATORY.`
    
    // API call using gemini-2.5-flash-image
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      system: { parts: [{ text: systemInstructionText }] },
      contents: { parts: parts },
      config: {
        responseModalities: [Modality.IMAGE],
        imageConfig: {
          aspectRatio: '9:16',
          numberOfImages: 1
        }
      },
    })
    
    console.log('API Response received')
    
    // Extract image from response
    const imagePart = response.candidates?.[0]?.content?.parts.find((part: any) => part.inlineData)
    
    if (imagePart?.inlineData) {
      const base64Image = imagePart.inlineData.data
      return `data:image/png;base64,${base64Image}`
    }
    
    throw new Error('No image generated in response')
    
  } catch (error: any) {
    console.error('Error generating dressed model:', error)
    throw new Error(error.message || 'Failed to generate dressed model. Please try again.')
  }
}
