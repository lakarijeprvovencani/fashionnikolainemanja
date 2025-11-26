import { GoogleGenAI, Modality } from '@google/genai'
import { tokens } from './supabase'
import { notifyTokenUpdate } from '../contexts/TokenContext'

// Gemini API key - must be set in .env file
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

if (!API_KEY) {
  console.error('Missing VITE_GEMINI_API_KEY environment variable!')
  throw new Error('VITE_GEMINI_API_KEY is required. Please set it in your .env file.')
}

const ai = new GoogleGenAI({ apiKey: API_KEY })

// Token costs for different operations
export const TOKEN_COSTS = {
  createModel: 1,
  dressModel: 1,
  editModel: 1,
  generateVideo: 5
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
        notifyTokenUpdate() // Notify UI to refresh token display
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
        notifyTokenUpdate() // Notify UI to refresh token display
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

interface GenerateCaptionsOptions {
  imageUrl: string
  clothingDescription?: string
  sceneDescription?: string
  instagramOptions?: {
    tone?: 'casual' | 'medium' | 'formal'
    length?: 'short' | 'medium' | 'long'
    hashtags?: boolean
  }
  facebookOptions?: {
    tone?: 'casual' | 'medium' | 'formal'
    length?: 'short' | 'medium' | 'long'
  }
  emailOptions?: {
    tone?: 'casual' | 'medium' | 'formal'
    length?: 'short' | 'medium' | 'long'
  }
}

export const generateSocialMediaCaptions = async (options: GenerateCaptionsOptions): Promise<{
  instagram: string
  webshop: string
  facebook: string
  email: string
  emailSubject: string
}> => {
  try {
    const { imageUrl, clothingDescription, sceneDescription, instagramOptions, facebookOptions, emailOptions } = options
    
    // Default options
    const instagramTone = instagramOptions?.tone || 'medium'
    const instagramLength = instagramOptions?.length || 'medium'
    const instagramHashtags = instagramOptions?.hashtags ?? true

    const facebookTone = facebookOptions?.tone || 'casual'
    const facebookLength = facebookOptions?.length || 'medium'

    const emailTone = emailOptions?.tone || 'medium'
    const emailLength = emailOptions?.length || 'medium'
    
    // Build Instagram prompt based on options
    const instagramToneDesc = instagramTone === 'casual' ? 'casual, relaxed, friendly' : 
                              instagramTone === 'formal' ? 'professional, polished, refined' : 
                              'medium, conversational (not too formal, not too casual)'
    
    const instagramLengthDesc = instagramLength === 'short' ? 'short (1-2 sentences, max 150 characters)' :
                                instagramLength === 'long' ? 'long (detailed, max 2200 characters)' :
                                'medium length (3-5 sentences, 200-500 characters)'
    
    const instagramHashtagsDesc = instagramHashtags ? 'Include 5-8 relevant hashtags at the end' : 'NO hashtags'
    
    // Build Facebook prompt based on options
    const facebookToneDesc = facebookTone === 'casual' ? 'casual, friendly, conversational' :
                             facebookTone === 'formal' ? 'professional, business-like' :
                             'medium, balanced tone'
    
    const facebookLengthDesc = facebookLength === 'short' ? 'short (1-2 sentences)' :
                               facebookLength === 'long' ? 'long (detailed storytelling)' :
                               'medium length (3-4 sentences)'

    // Build Email prompt based on options
    const emailToneDesc = emailTone === 'casual' ? 'casual, friendly, informal' :
                         emailTone === 'formal' ? 'professional, corporate' :
                         'medium, balanced, informative'

    const emailLengthDesc = emailLength === 'short' ? 'short (1-2 paragraphs)' :
                           emailLength === 'long' ? 'long (detailed newsletter style)' :
                           'medium length (3-4 paragraphs)'
    
    // Fetch image and convert to base64
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const base64Image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    
    const base64Data = base64Image.split(',')[1]
    const imagePart = { inlineData: { data: base64Data, mimeType: blob.type } }
    
    const prompt = `Analyze this fashion model image and create four different social media/marketing captions:

1. INSTAGRAM: Create a natural Instagram caption with:
   - Tone: ${instagramToneDesc}
   - Length: ${instagramLengthDesc}
   - ${instagramHashtagsDesc}
   - Natural Instagram copy style - like a real person posting
   - Minimal emojis (1-2 max, use sparingly)
   - NO "link in bio", NO "shop now", NO promotional CTAs
   - NO SEO keywords or marketing jargon
   - Focus on describing the style and outfit naturally
   - Write as if sharing a personal style moment, not selling

2. WEB SHOP: Create a product description for an e-commerce website with:
   - Professional, detailed product description
   - Key features and benefits
   - Size and fit information
   - Material and care instructions
   - SEO-friendly language
   - Clear call-to-action

3. FACEBOOK: Create a Facebook post caption with:
   - Tone: ${facebookToneDesc}
   - Length: ${facebookLengthDesc}
   - Conversational, friendly approach
   - Storytelling approach
   - Engagement questions
   - Brand personality
   - Clear value proposition
   - NO hashtags

4. EMAIL: Create an email campaign with:
   - Tone: ${emailToneDesc}
   - Length: ${emailLengthDesc}
   - Professional email format
   - Compelling subject line (max 60 characters, attention-grabbing)
   - Clear email body with proper greeting and closing
   - Call-to-action
   - Brand-appropriate sign-off
   - Focus on the fashion product/collection

${clothingDescription ? `Clothing details: ${clothingDescription}` : ''}
${sceneDescription ? `Scene/Setting: ${sceneDescription}` : ''}

Return the response in this exact JSON format:
{
  "instagram": "caption text here",
  "webshop": "description text here",
  "facebook": "caption text here",
  "email": "email body text here",
  "emailSubject": "email subject line here"
}`

    const textPart = { text: prompt }
    
    const response_ai = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    })
    
    const textResponse = response_ai.candidates?.[0]?.content?.parts.find((part: any) => part.text)?.text || ''
    
    // Try to parse JSON from response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/) || textResponse.match(/```\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : textResponse
      const parsed = JSON.parse(jsonText.trim())
      
      return {
        instagram: parsed.instagram || '',
        webshop: parsed.webshop || '',
        facebook: parsed.facebook || '',
        email: parsed.email || '',
        emailSubject: parsed.emailSubject || ''
      }
    } catch (parseError) {
      console.error('JSON parsing failed, falling back to regex:', parseError)
      // Fallback: split by sections if JSON parsing fails
      const instagramMatch = textResponse.match(/INSTAGRAM[:\-]?\s*(.+?)(?=WEB SHOP|FACEBOOK|EMAIL|$)/is)
      const webshopMatch = textResponse.match(/WEB SHOP[:\-]?\s*(.+?)(?=FACEBOOK|EMAIL|$)/is)
      const facebookMatch = textResponse.match(/FACEBOOK[:\-]?\s*(.+?)(?=EMAIL|$)/is)
      const emailMatch = textResponse.match(/EMAIL[:\-]?\s*(.+?)(?=EMAIL SUBJECT|$)/is)
      const emailSubjectMatch = textResponse.match(/EMAIL SUBJECT[:\-]?\s*(.+?)$/is)
      
      return {
        instagram: instagramMatch ? instagramMatch[1].trim() : 'Check out this stunning look! ✨',
        webshop: webshopMatch ? webshopMatch[1].trim() : 'Premium quality fashion piece.',
        facebook: facebookMatch ? facebookMatch[1].trim() : 'Introducing our latest collection!',
        email: emailMatch ? emailMatch[1].trim() : 'Hello, check out our new collection!',
        emailSubject: emailSubjectMatch ? emailSubjectMatch[1].trim() : 'New Fashion Collection Alert!'
      }
    }
    
  } catch (error: any) {
    console.error('Error generating captions:', error)
    // Return fallback captions
    return {
      instagram: '✨ New arrival! Check out this stunning look. #Fashion #Style',
      webshop: 'Premium quality fashion piece. Available now.',
      facebook: 'Introducing our latest collection!',
      email: 'Hello, check out our new collection!',
      emailSubject: 'New Fashion Collection Alert!'
    }
  }
}

interface ExpandTextOptions {
  selectedText: string
  platform: 'instagram' | 'facebook' | 'email' | 'webshop'
  context?: string
  instagramOptions?: {
    tone?: 'casual' | 'medium' | 'formal'
    length?: 'short' | 'medium' | 'long'
    hashtags?: boolean
  }
  facebookOptions?: {
    tone?: 'casual' | 'medium' | 'formal'
    length?: 'short' | 'medium' | 'long'
  }
  emailOptions?: {
    tone?: 'casual' | 'medium' | 'formal'
    length?: 'short' | 'medium' | 'long'
  }
}

export const expandTextWithAI = async (options: ExpandTextOptions): Promise<string> => {
  try {
    const { selectedText, platform, context, instagramOptions, facebookOptions, emailOptions } = options
    
    // Build platform-specific instructions
    let platformInstruction = ''
    if (platform === 'instagram') {
      const tone = instagramOptions?.tone || 'medium'
      const length = instagramOptions?.length || 'medium'
      const hashtags = instagramOptions?.hashtags ?? true
      
      platformInstruction = `Continue and expand this Instagram caption. Tone: ${tone === 'casual' ? 'casual, relaxed' : tone === 'formal' ? 'professional, polished' : 'medium, conversational'}. Length: ${length === 'short' ? 'short (1-2 sentences)' : length === 'long' ? 'long (detailed)' : 'medium (3-5 sentences)'}. ${hashtags ? 'Include 5-8 relevant hashtags at the end.' : 'NO hashtags.'} Natural Instagram style, minimal emojis, NO promotional CTAs.`
    } else if (platform === 'facebook') {
      const tone = facebookOptions?.tone || 'casual'
      const length = facebookOptions?.length || 'medium'
      
      platformInstruction = `Continue and expand this Facebook post. Tone: ${tone === 'casual' ? 'casual, friendly' : tone === 'formal' ? 'professional' : 'medium, balanced'}. Length: ${length === 'short' ? 'short (1-2 sentences)' : length === 'long' ? 'long (detailed storytelling)' : 'medium (3-4 sentences)'}. Conversational, engaging, NO hashtags.`
    } else if (platform === 'email') {
      const tone = emailOptions?.tone || 'medium'
      const length = emailOptions?.length || 'medium'
      
      platformInstruction = `Continue and expand this email content. Tone: ${tone === 'casual' ? 'casual, friendly' : tone === 'formal' ? 'professional, corporate' : 'medium, informative'}. Length: ${length === 'short' ? 'short (1-2 paragraphs)' : length === 'long' ? 'long (detailed newsletter style)' : 'medium (3-4 paragraphs)'}. Professional email format with clear call-to-action.`
    } else {
      platformInstruction = `Continue and expand this product description. Professional, detailed, SEO-friendly.`
    }
    
    const prompt = `The user has started writing ${platform === 'instagram' ? 'an Instagram caption' : platform === 'facebook' ? 'a Facebook post' : platform === 'email' ? 'an email' : 'a product description'} and selected this text:

"${selectedText}"

${platformInstruction}

${context ? `Additional context: ${context}` : ''}

Continue from where the user left off. Keep the same style and tone as the selected text. Complete the thought naturally and expand it according to the platform requirements. Return ONLY the continuation text (do not repeat the selected text, just continue from it).`

    const response_ai = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }] },
    })
    
    const textResponse = response_ai.candidates?.[0]?.content?.parts.find((part: any) => part.text)?.text || ''
    
    return textResponse.trim()
  } catch (error: any) {
    console.error('Error expanding text:', error)
    throw new Error('Failed to expand text. Please try again.')
  }
}

interface ProcessClothingImageOptions {
  imageFile: File
  userId: string
}

/**
 * Processes uploaded clothing image:
 * - If it's a person wearing clothes, extracts only the clothing (without face/head)
 * - If it's clothing on hanger, keeps it as is
 * - Splits complete outfits into individual pieces (shirt, pants, etc.)
 */
export const processClothingImage = async (options: ProcessClothingImageOptions): Promise<string[]> => {
  try {
    const { imageFile, userId } = options
    
    // Convert image to base64
    const base64Image = await fileToBase64(imageFile)
    const base64Data = base64Image.split(',')[1]
    const imagePart = { inlineData: { data: base64Data, mimeType: imageFile.type } }
    
    // First, analyze what's in the image
    const analysisPrompt = `Analyze this image and determine:
1. Is this clothing on a hanger/mannequin OR a person wearing clothes?
2. If it's a person, identify all clothing items visible (shirt, pants, jacket, etc.)
3. Count how many separate clothing pieces are visible

Respond in JSON format:
{
  "type": "person" | "hanger" | "flat_lay",
  "clothing_items": ["shirt", "pants", ...],
  "count": number
}`

    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: analysisPrompt }] },
    })
    
    const analysisText = analysisResponse.candidates?.[0]?.content?.parts.find((part: any) => part.text)?.text || ''
    
    let analysis: { type: string; clothing_items: string[]; count: number }
    try {
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/) || analysisText.match(/```\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : analysisText
      analysis = JSON.parse(jsonText.trim())
    } catch {
      // Fallback: assume it's a person with multiple items
      analysis = { type: 'person', clothing_items: ['clothing'], count: 1 }
    }

    // If it's clothing on hanger or flat lay, return as single image
    if (analysis.type === 'hanger' || analysis.type === 'flat_lay') {
      return [base64Image]
    }

    // If it's a person, extract clothing without face/head and split into pieces
    // Strategy: Generate each clothing item separately with individual API calls
    const images: string[] = []
    
    console.log(`🎯 Extracting ${analysis.clothing_items.length} clothing items separately...`)
    
    // Generate each clothing item in a separate API call
    for (let i = 0; i < Math.min(analysis.clothing_items.length, 5); i++) {
      const item = analysis.clothing_items[i]
      console.log(`  Processing item ${i + 1}/${Math.min(analysis.clothing_items.length, 5)}: ${item}`)
      
      const extractionPrompt = `Extract ONLY the ${item} from this image. 

CRITICAL REQUIREMENTS:
1. Show ONLY the ${item} - nothing else
2. Remove ALL other clothing items, body parts, face, head, and skin
3. The ${item} should be isolated on a transparent or white background
4. Do NOT include any other clothing items in this image
5. Do NOT include any human body parts

Generate ONE image showing ONLY the ${item}.`

      try {
        const extractionResponse = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [imagePart, { text: extractionPrompt }] },
          config: {
            responseModalities: [Modality.IMAGE],
            imageConfig: {
              numberOfImages: 1
            }
          }
        })

        // Extract the image from this response
        const candidate = extractionResponse.candidates?.[0]
        if (candidate) {
          const parts = candidate.content?.parts || []
          for (const part of parts) {
            if (part.inlineData) {
              images.push(`data:image/png;base64,${part.inlineData.data}`)
              console.log(`  ✅ Extracted ${item} (image ${images.length})`)
              break // Only take first image from this response
            }
          }
        }
        
        // Small delay between requests to avoid rate limiting
        if (i < Math.min(analysis.clothing_items.length, 5) - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (err) {
        console.error(`  ⚠️ Error extracting ${item}:`, err)
        // Continue with next item
      }
    }
    
    console.log(`📊 Total extracted images: ${images.length}`)

    // If we got images, return them; otherwise return original
    if (images.length > 0) {
      return images
    }

    // Fallback: try simpler extraction (just remove person, keep clothing)
    const simpleExtractionPrompt = `Extract only the clothing from this image. Remove the person's face, head, and body. Show only the clothing items on a neutral background.`
    
    const simpleResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [imagePart, { text: simpleExtractionPrompt }] },
      config: {
        responseModalities: [Modality.IMAGE],
        imageConfig: {
          numberOfImages: 1
        }
      }
    })

    const simpleImagePart = simpleResponse.candidates?.[0]?.content?.parts.find((part: any) => part.inlineData)
    if (simpleImagePart?.inlineData) {
      return [`data:image/png;base64,${simpleImagePart.inlineData.data}`]
    }

    // Last resort: return original
    return [base64Image]
    
  } catch (error: any) {
    console.error('Error processing clothing image:', error)
    // Return original image if processing fails
    const base64Image = await fileToBase64(options.imageFile)
    return [base64Image]
  }
}

interface EditImageOptions {
  imageUrl: string
  prompt: string
  userId: string
}

export const editFashionImage = async (options: EditImageOptions): Promise<string> => {
  try {
    const { imageUrl, prompt, userId } = options
    
    // Check tokens
    const { hasTokens } = await tokens.hasEnoughTokens(userId, TOKEN_COSTS.editModel)
    if (!hasTokens) {
      throw new Error('Insufficient tokens for editing.')
    }

    // Fetch image
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const base64Image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    
    const base64Data = base64Image.split(',')[1]
    const imagePart = { inlineData: { data: base64Data, mimeType: blob.type } }
    
    const editPrompt = `Edit this image according to the following instruction: ${prompt}. Maintain the original style, lighting, and quality. Only modify what is asked.`
    const textPart = { text: editPrompt }
    
    console.log('🎨 Editing image with prompt:', prompt)
    
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseModalities: [Modality.IMAGE],
        imageConfig: {
          numberOfImages: 1
        }
      }
    })
    
    const imageResultPart = aiResponse.candidates?.[0]?.content?.parts.find((part: any) => part.inlineData)
    
    if (imageResultPart?.inlineData) {
      // Deduct tokens
      const { success } = await tokens.deductTokens(userId, TOKEN_COSTS.editModel, 'Edited fashion image')
      if (success) {
        notifyTokenUpdate() // Notify UI to refresh token display
      }
      return `data:image/png;base64,${imageResultPart.inlineData.data}`
    }
    
    throw new Error('No image generated from edit request')
    
  } catch (error: any) {
    console.error('Error editing image:', error)
    throw new Error(error.message || 'Failed to edit image.')
  }
}

interface GenerateVideoOptions {
  imageUrl: string
  prompt?: string
  userId: string
}

export const generateFashionVideo = async (options: GenerateVideoOptions): Promise<string> => {
  try {
    const { imageUrl, prompt, userId } = options
    
    // Check tokens - Video is expensive, let's say 5 tokens
    const VIDEO_COST = 5
    const { hasTokens } = await tokens.hasEnoughTokens(userId, VIDEO_COST)
    if (!hasTokens) {
      throw new Error(`Insufficient tokens for video generation. Requires ${VIDEO_COST} tokens.`)
    }

    console.log('🎬 Starting video generation...')
    
    // Fetch image
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    
    // Gemini Video Generation (using Veo)
    // Note: The SDK method signatures might vary, adjusting for typical Veo usage
    // Since direct image-to-video might need specific endpoint, we'll use generateVideos if available or fallback logic
    
    // Convert to base64 for the API
    const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
    const base64Data = base64Image.split(',')[1]

    const videoPrompt = prompt || "Fashion model posing, subtle movement, professional lighting, 4k resolution, cinematic slow motion"
    
    // Using the correct method for video generation if available in this SDK version
    // If ai.models.generateVideos is not available, we might need to use a different approach
    // Assuming google-genai SDK has generateVideos or similar for Veo
    
    try {
        // @ts-ignore - Ignoring TS error if method name differs in installed version
        const videoOp = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001', // or veo-3.0-fast-generate-preview
            prompt: videoPrompt,
            image: {
                imageBytes: base64Data,
                mimeType: blob.type
            },
            config: {
                numberOfVideos: 1,
                aspectRatio: '9:16' // Matching typical fashion content
            }
        })
        
        console.log('Video operation started:', videoOp)
        
        // Polling for completion
        let operation = videoOp
        let attempts = 0
        const maxAttempts = 60 // 5 minutes roughly
        
        while (!operation.done && attempts < maxAttempts) {
            attempts++
            await new Promise(r => setTimeout(r, 5000))
            // @ts-ignore
            operation = await ai.operations.getVideosOperation({ operation: operation })
            console.log('Video generation status:', operation.state)
        }
        
        if (operation.done && operation.result?.videos?.[0]?.uri) {
            const videoUri = operation.result.videos[0].uri
            
            // Deduct tokens
            const { success } = await tokens.deductTokens(userId, VIDEO_COST, 'Generated fashion video')
            if (success) {
              notifyTokenUpdate() // Notify UI to refresh token display
            }
            
            // The URI might be temporary, usually we'd download it here. 
            // For now returning the URI or if it requires auth, we might need to proxy or fetch it.
            // Often these URIs are signed google storage links.
            return videoUri
        }
        
        throw new Error('Video generation failed or timed out')
        
    } catch (veoError) {
        console.error('Veo generation error:', veoError)
        // Fallback or detailed error
        throw veoError
    }

  } catch (error: any) {
    console.error('Error generating video:', error)
    throw new Error(error.message || 'Failed to generate video.')
  }
}
