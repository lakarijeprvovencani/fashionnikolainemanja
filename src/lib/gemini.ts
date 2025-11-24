import { GoogleGenAI, Modality } from '@google/genai'
import { tokens } from './supabase'

// Gemini API key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyAPQ_PhnJe3b1QJbt8DV9wdV2GhSCps_80'

const ai = new GoogleGenAI({ apiKey: API_KEY })

// Token costs for different operations
export const TOKEN_COSTS = {
  createModel: 1,
  dressModel: 1,
  editModel: 1
}

interface GenerateModelOptions {
  prompt: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:5' | '2:3' | '3:2' | '3:4' | '4:3' | '5:4' | '21:9'
  userId: string
}

export const generateFashionModel = async (options: GenerateModelOptions): Promise<string> => {
  try {
    const { prompt, aspectRatio = '9:16', userId } = options
    
    // Check if user has enough tokens
    console.log('🔍 Checking token balance...')
    const { hasTokens } = await tokens.hasEnoughTokens(userId, TOKEN_COSTS.createModel)
    
    if (!hasTokens) {
      throw new Error('Insufficient tokens. Please upgrade your plan or purchase more tokens.')
    }
    
    console.log('✅ Token check passed')
    
    // System instruction za fashion model
    const systemInstructionText = `You are an AI fashion model generator. Your task is to create photorealistic fashion models based on user descriptions. The models must be professional, high-quality, and suitable for fashion design and clothing presentation. Focus on editorial fashion photography style with professional lighting and clean backgrounds.`
    
    // Korisnikov prompt
    const enhancedPrompt = `${prompt}. Style: Editorial fashion photography, professional lighting, clean background, full body shot, fashion runway quality, high resolution, photorealistic.`
    
    console.log('Generating model with prompt:', enhancedPrompt)
    
    // API poziv sa Gemini 3 Pro Image Preview (sa "Thinking" procesom i boljom konzistentnošću)
    console.log('🚀 Using Gemini 3 Pro Image Preview with Thinking process')
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
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
      
      // Deduct tokens after successful generation
      console.log(`💳 Deducting ${TOKEN_COSTS.createModel} token(s)...`)
      const { success, balanceAfter } = await tokens.deductTokens(
        userId, 
        TOKEN_COSTS.createModel, 
        'Created fashion model'
      )
      
      if (success) {
        console.log(`✅ Tokens deducted. Balance: ${balanceAfter}`)
      } else {
        console.warn('⚠️ Token deduction failed but image was generated')
      }
      
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
    
    console.log('Transforming uploaded image to model in swimwear with Gemini 3 Pro Image Preview...')
    
    const base64Data = base64Image.split(',')[1]
    const imagePart = { inlineData: { data: base64Data, mimeType: imageFile.type } }
    
    // Test prompt - samo promeni pozadinu u sivu
    const transformPrompt = `Change the background to solid gray. Keep everything else exactly the same.`
    
    const textPart = { text: transformPrompt }
    
    // API poziv sa Gemini 3 Pro Image Preview modelom koji podržava image input
    console.log('🚀 Using Gemini 3 Pro Image Preview for image transformation')
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
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
  userId: string
}

export const generateDressedModel = async (options: DressModelOptions): Promise<string> => {
  try {
    const { modelImageUrl, clothingImages, backgroundPrompt, userId } = options
    
    // Check if user has enough tokens
    console.log('🔍 Checking token balance for dress model...')
    const { hasTokens } = await tokens.hasEnoughTokens(userId, TOKEN_COSTS.dressModel)
    
    if (!hasTokens) {
      throw new Error('Insufficient tokens. Please upgrade your plan or purchase more tokens.')
    }
    
    console.log('✅ Token check passed')
    
    // Fetch the original model image
    console.log('📥 Fetching model image from:', modelImageUrl)
    const modelImageResponse = await fetch(modelImageUrl)
    
    if (!modelImageResponse.ok) {
      throw new Error(`Failed to fetch model image: ${modelImageResponse.status}`)
    }
    
    const modelImageBlob = await modelImageResponse.blob()
    console.log('✅ Model image fetched successfully, size:', modelImageBlob.size, 'bytes')
    
    const modelImageFile = new File([modelImageBlob], 'model.png', { type: modelImageBlob.type })
    const modelImageBase64 = await fileToBase64(modelImageFile)
    console.log('✅ Model image converted to base64')
    
    // Convert clothing images to base64
    const clothingBase64Array = await Promise.all(
      clothingImages.map(file => fileToBase64(file))
    )
    
    // Build the prompt - EXPLICITLY state to use the SAME model from the first image
    const clothingDescription = clothingImages.length === 1 
      ? 'the clothing item shown'
      : `the ${clothingImages.length} clothing items shown`
    
    const prompt = `🚨 CRITICAL INSTRUCTION - THIS IS THE MOST IMPORTANT RULE 🚨

IMAGE 1 (FIRST IMAGE) = YOUR REFERENCE MODEL
This person MUST appear in your generated image.

YOUR TASK:
Generate a new photo of the EXACT SAME PERSON from IMAGE 1 (first image), but now wearing ${clothingDescription} from the subsequent clothing images.

Scene/Setting: ${backgroundPrompt}

🔒 MANDATORY REQUIREMENTS:
1. FACE: Use the EXACT face from IMAGE 1 - same person, same facial features, same skin tone, same eye color, same nose, same mouth, IDENTICAL facial structure
2. BODY: Use the EXACT body from IMAGE 1 - same body type, same physique, same proportions, same height
3. IDENTITY: The SAME PERSON from IMAGE 1 - this is MANDATORY, not optional
4. ETHNICITY: Must match IMAGE 1 exactly - same ethnicity, same appearance
5. GENDER: Must match IMAGE 1 exactly

✅ WHAT YOU CAN MODIFY:
- Clothing: Dress the person from IMAGE 1 in ${clothingDescription}
- Pose: Adjust pose based on "${backgroundPrompt}"
- Background: Set location as described
- Camera angle and lighting

❌ WHAT IS FORBIDDEN TO CHANGE:
- The person's face (LOCKED to IMAGE 1)
- The person's identity (LOCKED to IMAGE 1)
- The person's body type (LOCKED to IMAGE 1)
- The person's ethnicity (LOCKED to IMAGE 1)

VERIFICATION STEP: Confirm you are using the person from IMAGE 1 before generating.

OUTPUT: Professional fashion photography, photorealistic, high resolution.`

    console.log('🎬 Generating dressed model with SAME model constraint')
    console.log('📸 Model image URL:', modelImageUrl)
    console.log('👗 Number of clothing images:', clothingImages.length)
    console.log('📝 Scene prompt:', backgroundPrompt)
    console.log('📋 Full prompt being sent:')
    console.log(prompt)
    
    // Prepare parts for the API call
    // ORDER IS CRITICAL: MODEL IMAGE FIRST (reference), CLOTHING IMAGES, then TEXT PROMPT
    const parts: any[] = []
    
    // 1. MODEL IMAGE comes FIRST (this is the reference person that MUST be used)
    console.log('✅ Adding MODEL image as FIRST/REFERENCE image')
    parts.push({
      inlineData: {
        mimeType: modelImageFile.type,
        data: modelImageBase64.split(',')[1]
      }
    })
    
    // 2. CLOTHING IMAGES come SECOND
    console.log(`✅ Adding ${clothingImages.length} clothing image(s)`)
    clothingBase64Array.forEach((base64Image, index) => {
      parts.push({
        inlineData: {
          mimeType: clothingImages[index].type,
          data: base64Image.split(',')[1]
        }
      })
    })
    
    // 3. TEXT INSTRUCTIONS come LAST (referencing the images above)
    console.log('✅ Adding text prompt (references images above)')
    parts.push({ text: prompt })
    
    console.log('📦 Total parts in request:', parts.length, '(1 model + ' + clothingImages.length + ' clothing + 1 text)')
    
    // System instruction
    const systemInstructionText = `You are an AI fashion photographer specialized in consistent model photography.

🎯 YOUR PRIMARY OBJECTIVE:
The FIRST image you receive contains a MODEL/PERSON. This is your REFERENCE MODEL.
You MUST use this EXACT SAME PERSON in your generated image.

NON-NEGOTIABLE RULES:
1. FIRST IMAGE = REFERENCE MODEL - You must use this exact person
2. PRESERVE 100% of the model's identity: face, body, ethnicity, skin tone, all features
3. DO NOT create a new person - DO NOT change the model
4. DO NOT generate a different face - USE THE FACE FROM FIRST IMAGE
5. The subsequent images show CLOTHING to put on the reference model

PROCESS:
Step 1: Identify the person in the FIRST image
Step 2: Take clothing from the subsequent images  
Step 3: Generate the SAME PERSON from Step 1 wearing the clothing from Step 2
Step 4: Apply scene description for pose and background

The person's identity MUST remain unchanged. Only clothing, pose, and scene can change.`
    
    // API call using Gemini 3 Pro Image Preview (professional quality with "Thinking" process)
    console.log('🚀 Calling Gemini API with: Gemini 3 Pro Image Preview')
    console.log('✨ Features: Thinking process, Real-world grounding, Up to 4K resolution')
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
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
    
    console.log('✅ API Response received')
    
    // Extract image from response
    const imagePart = response.candidates?.[0]?.content?.parts.find((part: any) => part.inlineData)
    
    if (imagePart?.inlineData) {
      const base64Image = imagePart.inlineData.data
      
      // Deduct tokens after successful generation
      console.log(`💳 Deducting ${TOKEN_COSTS.dressModel} token(s)...`)
      const { success, balanceAfter } = await tokens.deductTokens(
        userId, 
        TOKEN_COSTS.dressModel, 
        'Dressed model with outfit'
      )
      
      if (success) {
        console.log(`✅ Tokens deducted. Balance: ${balanceAfter}`)
      } else {
        console.warn('⚠️ Token deduction failed but image was generated')
      }
      
      return `data:image/png;base64,${base64Image}`
    }
    
    throw new Error('No image generated in response')
    
  } catch (error: any) {
    console.error('Error generating dressed model:', error)
    throw new Error(error.message || 'Failed to generate dressed model. Please try again.')
  }
}
