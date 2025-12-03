import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { generateSocialMediaCaptions, expandTextWithAI } from '../lib/gemini'
import { userHistory, aiGeneratedContent, storage } from '../lib/supabase'
import JSZip from 'jszip'

interface CreateCaptionsNovoProps {
  imageUrl: string | null
  scenePrompt?: string
  onBack?: () => void
  onNavigate?: (view: string) => void
}

// Safe localStorage wrapper
const safeLocalStorage = {
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded')
      }
    }
  },
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch {}
  }
}

const CreateCaptionsNovo: React.FC<CreateCaptionsNovoProps> = ({ imageUrl, scenePrompt, onBack, onNavigate }) => {
  const { user } = useAuth()
  const [captions, setCaptions] = useState({
    instagram: '',
    webshop: '',
    facebook: '',
    email: '',
    emailSubject: ''
  })
  const [loading, setLoading] = useState({
    instagram: false,
    webshop: false,
    facebook: false,
    email: false
  })
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'instagram' | 'webshop' | 'facebook' | 'email'>('instagram')
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  // Caption options
  const [instagramOptions, setInstagramOptions] = useState({
    tone: 'medium' as 'casual' | 'medium' | 'formal',
    length: 'medium' as 'short' | 'medium' | 'long',
    hashtags: true
  })
  
  const [facebookOptions, setFacebookOptions] = useState({
    tone: 'casual' as 'casual' | 'medium' | 'formal',
    length: 'medium' as 'short' | 'medium' | 'long'
  })

  const [emailOptions, setEmailOptions] = useState({
    tone: 'medium' as 'casual' | 'medium' | 'formal',
    length: 'medium' as 'short' | 'medium' | 'long'
  })
  
  // Product info for webshop
  const [productName, setProductName] = useState<string>('')
  const [productPrice, setProductPrice] = useState<string>('')
  
  // Text selection for AI expansion
  const [selectedText, setSelectedText] = useState('')
  const [selectionStart, setSelectionStart] = useState(0)
  const [selectionEnd, setSelectionEnd] = useState(0)
  const [expandingText, setExpandingText] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const [currentImage, setCurrentImage] = useState<string | null>(() => {
    // Check for ad-specific image first
    const adType = safeLocalStorage.getItem('captions_adType')
    if (adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      const adImage = safeLocalStorage.getItem(`${prefix}_captionsImage`)
      if (adImage) return adImage
    }
    const saved = safeLocalStorage.getItem('dressModel_generatedImage')
    return saved || imageUrl
  })
  
  const [currentScenePrompt, setCurrentScenePrompt] = useState<string>(() => {
    const adType = safeLocalStorage.getItem('captions_adType')
    if (adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      const adPrompt = safeLocalStorage.getItem(`${prefix}_captionsPrompt`)
      if (adPrompt) return adPrompt
    }
    const saved = safeLocalStorage.getItem('dressModel_scenePrompt')
    return saved || scenePrompt || ''
  })

  useEffect(() => {
    // Load image from localStorage or props
    const adType = safeLocalStorage.getItem('captions_adType')
    if (adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      const adImage = safeLocalStorage.getItem(`${prefix}_captionsImage`)
      if (adImage) {
        setCurrentImage(adImage)
      }
      const adPrompt = safeLocalStorage.getItem(`${prefix}_captionsPrompt`)
      if (adPrompt) {
        setCurrentScenePrompt(adPrompt)
      }
    } else {
      const saved = safeLocalStorage.getItem('dressModel_generatedImage')
      if (saved) {
        setCurrentImage(saved)
      } else if (imageUrl) {
        setCurrentImage(imageUrl)
      }
      const savedPrompt = safeLocalStorage.getItem('dressModel_scenePrompt')
      if (savedPrompt) {
        setCurrentScenePrompt(savedPrompt)
      } else if (scenePrompt) {
        setCurrentScenePrompt(scenePrompt)
      }
    }
  }, [imageUrl, scenePrompt])

  const generateSpecificCaption = async (platform: 'instagram' | 'webshop' | 'facebook' | 'email') => {
    const imageToUse = currentImage || imageUrl
    if (!imageToUse) return

    setLoading({ ...loading, [platform]: true })
    setError('')

    try {
      const generated = await generateSocialMediaCaptions({
        imageUrl: imageToUse,
        sceneDescription: currentScenePrompt || scenePrompt,
        userId: user?.id,
        instagramOptions: platform === 'instagram' ? instagramOptions : undefined,
        facebookOptions: platform === 'facebook' ? facebookOptions : undefined,
        emailOptions: platform === 'email' ? emailOptions : undefined
      })
      
      setCaptions({ 
        ...captions, 
        [platform]: generated[platform],
        emailSubject: platform === 'email' ? generated.emailSubject : captions.emailSubject
      })
      
      // Save to appropriate localStorage key
      const adType = safeLocalStorage.getItem('captions_adType')
      if (adType) {
        const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        // Save captions for the platform
        if (platform === 'instagram' || platform === 'facebook') {
          safeLocalStorage.setItem(`${prefix}_${platform}Caption`, generated[platform])
        }
        if (platform === 'email' && generated.emailSubject) {
          safeLocalStorage.setItem(`${prefix}_emailSubject`, generated.emailSubject)
          safeLocalStorage.setItem(`${prefix}_emailCaption`, generated.email)
        }
      }
      
      // Save to activity history
      if (user?.id && generated[platform]) {
        await userHistory.saveActivity({
          userId: user.id,
          activityType: 'create_captions',
          imageUrl: imageToUse || null,
          captions: { [platform]: generated[platform] } as any,
          metadata: {
            platform: platform,
            emailSubject: platform === 'email' ? generated.emailSubject : undefined
          }
        }).catch(err => console.error('Error saving activity:', err))

        // Autosave to AI generated content
        try {
          await aiGeneratedContent.saveContent({
            userId: user.id,
            contentType: `caption_${platform}` as any,
            title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Caption`,
            imageUrl: imageToUse || undefined,
            prompt: currentScenePrompt || scenePrompt || undefined,
            captions: {
              [platform]: generated[platform],
              emailSubject: platform === 'email' ? generated.emailSubject : undefined
            }
          }).catch(err => console.error('Error autosaving caption:', err))
        } catch (err) {
          console.error('Error autosaving caption:', err)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate caption.')
    } finally {
      setLoading({ ...loading, [platform]: false })
    }
  }

  const copyCaption = (platform: 'instagram' | 'webshop' | 'facebook' | 'email') => {
    if (platform === 'email' && captions.email) {
      const emailContent = `Subject: ${captions.emailSubject}\n\n${captions.email}`
      navigator.clipboard.writeText(emailContent)
    } else if (captions[platform]) {
      navigator.clipboard.writeText(captions[platform])
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = async () => {
    if (!currentImage) return
    
    // For webshop tab, check if product name and price are provided
    if (activeTab === 'webshop' && (!productName || !productPrice)) {
      const missingFields = []
      if (!productName) missingFields.push('Product Name')
      if (!productPrice) missingFields.push('Price')
      
      const proceed = confirm(
        `Missing required fields: ${missingFields.join(' and ')}\n\n` +
        `Without these fields, CSV files will NOT be included in the export.\n\n` +
        `Do you want to continue with export anyway?\n\n` +
        `(You'll only get the image and description text file)`
      )
      
      if (!proceed) {
        return
      }
    }
    
    setExporting(true)
    try {
      const zip = new JSZip()
      
      // Add image
      const imageResponse = await fetch(currentImage)
      const imageBlob = await imageResponse.blob()
      zip.file('product-image.png', imageBlob)
      
      // Add caption file based on active tab
      if (activeTab === 'instagram') {
        zip.file('instagram-caption.txt', captions.instagram)
        const readme = `# Instagram Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image
- instagram-caption.txt - Instagram post caption

## Instructions:
1. Open Instagram app or website
2. Create a new post
3. Upload product-image.png
4. Copy and paste the caption from instagram-caption.txt
5. Add hashtags if needed
6. Post!

Enjoy! 🎉
`
        zip.file('README.txt', readme)
      } else if (activeTab === 'facebook') {
        zip.file('facebook-caption.txt', captions.facebook)
        const readme = `# Facebook Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image
- facebook-caption.txt - Facebook post caption

## Instructions:
1. Go to Facebook and create a new post
2. Upload product-image.png
3. Copy and paste the caption from facebook-caption.txt
4. Post!

Enjoy! 🎉
`
        zip.file('README.txt', readme)
      } else if (activeTab === 'email') {
        const emailContent = `Subject: ${captions.emailSubject}\n\n${captions.email}`
        zip.file('email-campaign.txt', emailContent)
        const readme = `# Email Campaign Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image (local backup copy)
- email-campaign.txt - Email subject and body

## Instructions:
1. Open your email client or marketing platform.
2. Create a new email.
3. Set the subject line using the "Subject" from email-campaign.txt.
4. Copy and paste the email body from email-campaign.txt.
5. Upload product-image.png as an attachment or embed it in the email.
6. Customize as needed and send!

Enjoy! 🎉
`
        zip.file('README.txt', readme)
      } else if (activeTab === 'webshop') {
        zip.file('webshop-description.txt', captions.webshop)
        
        // Add CSV files only if price and name are provided
        if (productName && productPrice) {
          // Upload image to Supabase storage to get public URL for CSV files
          let imagePublicUrl = ''
          
          // Try to upload image, but continue even if it fails
          try {
            if (!user?.id) {
              throw new Error('User not authenticated. Please log in to export with image URLs.')
            }
            
            if (!currentImage) {
              throw new Error('No image available to upload')
            }
            
            // Check bucket configuration first - try dressed-models, fallback to model-images
            let bucketToUse = 'dressed-models'
            console.log('Checking bucket configuration...')
            let bucketConfig = await storage.checkBucketConfig('dressed-models')
            console.log('Bucket config result for dressed-models:', bucketConfig)
            
            // If dressed-models doesn't exist, try model-images as fallback
            if (!bucketConfig.success && bucketConfig.error?.includes('does not exist')) {
              console.log('dressed-models bucket not found, trying model-images...')
              bucketToUse = 'model-images'
              bucketConfig = await storage.checkBucketConfig('model-images')
              console.log('Bucket config result for model-images:', bucketConfig)
              
              if (!bucketConfig.success) {
                const availableBuckets = bucketConfig.availableBuckets || []
                throw new Error(`Neither "dressed-models" nor "model-images" bucket exists.\n\nAvailable buckets: ${availableBuckets.join(', ') || 'none'}\n\nPlease create a bucket in Supabase Dashboard:\n1. Go to Storage\n2. Click "New bucket"\n3. Name it "dressed-models"\n4. Make it PUBLIC\n5. Save`)
              }
            } else if (!bucketConfig.success) {
              const errorMsg = bucketConfig.error || 'Unknown error'
              throw new Error(`Bucket check failed: ${errorMsg}`)
            }
            
            // Log bucket info
            if (bucketConfig.bucket) {
              console.log('Bucket info:', {
                name: bucketConfig.bucket.name,
                public: bucketConfig.bucket.public,
                canList: bucketConfig.canList
              })
              
              if (!bucketConfig.bucket.public) {
                console.warn('⚠️ Bucket is not public. This might cause issues with image URLs.')
              }
            }
            
            // Test storage upload
            console.log(`Testing storage upload to bucket: ${bucketToUse}...`)
            const storageTest = await storage.testStorage(bucketToUse)
            console.log('Storage test result:', storageTest)
            
            if (!storageTest.success) {
              throw new Error(`Storage test failed: ${storageTest.message || storageTest.error}\n\nThis might be a permissions issue. Please check:\n1. Bucket "${bucketToUse}" exists\n2. Bucket is public or has proper RLS policies\n3. User has upload permissions`)
            }
            
            let imageBlob: Blob
            
            // Check if currentImage is a base64 data URL or a regular URL
            if (currentImage.startsWith('data:image/')) {
              // It's a base64 data URL - convert directly to blob
              console.log('Converting base64 data URL to blob...')
              const base64Data = currentImage.split(',')[1]
              const byteCharacters = atob(base64Data)
              const byteNumbers = new Array(byteCharacters.length)
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
              }
              const byteArray = new Uint8Array(byteNumbers)
              imageBlob = new Blob([byteArray], { type: 'image/png' })
            } else {
              // It's a regular URL - fetch it
              console.log('Fetching image from URL...', currentImage.substring(0, 50))
              const imageResponse = await fetch(currentImage)
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`)
              }
              imageBlob = await imageResponse.blob()
            }
            
            if (!imageBlob || imageBlob.size === 0) {
              throw new Error(`Image blob is empty (size: ${imageBlob?.size || 0})`)
            }
            
            // Convert Blob to File (Supabase storage prefers File)
            const imageFileName = `product-export-${Date.now()}.png`
            const imageFile = new File([imageBlob], imageFileName, { type: 'image/png' })
            const imagePath = `${user.id}/${imageFileName}`
            
            console.log(`Uploading image to storage:`, { 
              bucket: bucketToUse, 
              path: imagePath, 
              size: imageFile.size,
              type: imageFile.type
            })
            
            const { url, error: uploadError } = await storage.uploadImage(bucketToUse, imagePath, imageFile)
            
            if (uploadError) {
              console.error('Upload error details:', uploadError)
              throw new Error(uploadError?.message || JSON.stringify(uploadError) || 'Failed to upload image to storage')
            }
            
            if (!url) {
              throw new Error('Upload succeeded but no URL returned')
            }
            
            imagePublicUrl = url
            console.log('✅ Image uploaded successfully:', imagePublicUrl)
          } catch (uploadErr: any) {
            console.error('❌ Error uploading image:', {
              error: uploadErr,
              message: uploadErr?.message,
              stack: uploadErr?.stack,
              user: user?.id,
              hasImage: !!currentImage,
              imageType: currentImage?.substring(0, 20)
            })
            // Show error to user so they know what happened
            // Note: CSV will still be generated, just without image URL
            console.warn('Image upload failed, but CSV will still be generated without image URL')
          }
          
          // CSV files will be generated here regardless of upload success/failure
          console.log('Generating CSV files...', { productName, productPrice, hasImageUrl: !!imagePublicUrl })
          
          // Helper function to decode HTML entities
          const decodeHtmlEntities = (text: string): string => {
            // Decode common HTML entities
            return text
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&nbsp;/g, ' ')
              .replace(/&apos;/g, "'")
          }
          
          // Clean description: decode HTML entities and format for Shopify HTML description
          const cleanDescription = (text: string): string => {
            // Decode HTML entities first
            let cleaned = decodeHtmlEntities(text)
            
            // Replace markdown-style bold with HTML
            cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            
            // Replace line breaks with HTML breaks
            cleaned = cleaned.replace(/\n\n/g, '<br><br>')
            cleaned = cleaned.replace(/\n/g, '<br>')
            
            // Replace bullet points (*) with HTML list
            cleaned = cleaned.replace(/^\s*\*\s+(.+)$/gm, '<li>$1</li>')
            
            // Wrap consecutive list items in <ul> tags
            cleaned = cleaned.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/g, '<ul>$1</ul>')
            
            // Clean up extra spaces but preserve HTML structure
            cleaned = cleaned.replace(/\s+/g, ' ')
            
            return cleaned.trim()
          }
          
          const cleanedDescription = cleanDescription(captions.webshop)
          
          // WooCommerce CSV - Full format matching WooCommerce import requirements
          const wcShortDescription = cleanedDescription.substring(0, 160) // Short description (first 160 chars)
          const wcDescription = cleanedDescription // Full description
          const wcImageUrl = imagePublicUrl || 'product-image.png'
          
          // Generate SKU from product name
          const wcSku = productName.toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 20)
          
          const csvContent = `Type,SKU,Name,Published,Is featured?,Visibility in catalog,Short description,Description,Date sale price starts,Date sale price ends,Tax status,Tax class,In stock?,Stock,Low stock amount,Backorders allowed?,Sold individually?,Weight (kg),Length (cm),Width (cm),Height (cm),Allow customer reviews?,Purchase note,Sale price,Regular price,Categories,Tags,Shipping class,Images,Downloadable,Download limit,Download expiry,Parent,Grouped products,Upsells,Cross-sells,External URL,Button text,Position
simple,${wcSku},"${productName}",1,0,visible,"${wcShortDescription.replace(/"/g, '""')}","${wcDescription.replace(/"/g, '""')}",,,taxable,,1,100,5,0,0,,,,,1,,"${productPrice}","${productPrice}",Apparel|Clothing,fashion,,"${wcImageUrl}",0,,-1,,,,,Buy Now,0`
          zip.file('woocommerce-import.csv', csvContent)
          console.log('✅ Added woocommerce-import.csv to ZIP')
          
          // Shopify CSV - Matching Shopify's exact template format
          const handle = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          // For Shopify, keep HTML formatting but clean entities
          const escapedDescription = cleanedDescription.replace(/"/g, '""').replace(/\n/g, '<br>')
          const compareAtPrice = (parseFloat(productPrice) * 1.2).toFixed(2)
          
          // Use public URL if available, otherwise leave blank (user can upload manually)
          // Format image URL properly for CSV (with quotes if URL exists)
          const imageUrlForCsv = imagePublicUrl ? `"${imagePublicUrl}"` : ''
          
          console.log('CSV Export Details:', {
            hasImageUrl: !!imagePublicUrl,
            imageUrl: imagePublicUrl,
            productName,
            productPrice,
            descriptionLength: escapedDescription.length,
            willGenerateCSV: true
          })
          
          const shopifyCsv = `Title,URL handle,Description,Vendor,Product category,Type,Tags,Published on online store,Status,SKU,Barcode,Option1 name,Option1 value,Option2 name,Option2 value,Option3 name,Option3 value,Price,Compare-at price,Cost per item,Charge tax,Tax code,Unit price total measure,Unit price total measure unit,Unit price base measure,Unit price base measure unit,Inventory tracker,Inventory quantity,Continue selling when out of stock,Requires shipping,Fulfillment service,Product image URL,Image position,Image alt text,Variant image URL,Gift card,SEO title,SEO description,Google Shopping / Google product category,Google Shopping / Gender,Google Shopping / Age group,Google Shopping / MPN,Google Shopping / AdWords Grouping,Google Shopping / AdWords labels,Google Shopping / Condition,Google Shopping / Custom product,Google Shopping / Custom label 0,Google Shopping / Custom label 1,Google Shopping / Custom label 2,Google Shopping / Custom label 3,Google Shopping / Custom label 4
"${productName}","${handle}","${escapedDescription}",Fashion,Apparel & Accessories > Clothing,Apparel,fashion clothing,TRUE,active,,,Title,Default,,,,,${productPrice},${compareAtPrice},,TRUE,,,,,,,,deny,TRUE,manual,${imageUrlForCsv},1,"${productName}",,FALSE,"${productName.substring(0, 70)}","${escapedDescription.substring(0, 320)}",Apparel & Accessories > Clothing,Unisex,Adult,,,,,,,,,,,,`
          zip.file('shopify-import.csv', shopifyCsv)
          console.log('✅ Added shopify-import.csv to ZIP')
          
          const readme = `# Web Shop Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image (local backup copy)
- webshop-description.txt - Product description
- woocommerce-import.csv - Ready to import into WooCommerce
- shopify-import.csv - Ready to import into Shopify

## Important Notes:

✅ **Description Formatting**: The product description has been cleaned and formatted:
   - HTML entities (like &amp;) have been decoded to normal characters (&)
   - Markdown formatting (**bold**) has been converted to HTML (<strong>bold</strong>)
   - Line breaks and bullet points are properly formatted for Shopify

${imagePublicUrl ? `✅ **Image URL**: The product image has been uploaded to cloud storage and the URL is included in the CSV files.` : '⚠️ **Image URL**: Image upload failed. The CSV files do not include an image URL. You will need to upload product-image.png manually after importing.'}

## Instructions:

### For WooCommerce:
1. Go to Products > Import
2. Upload woocommerce-import.csv
3. Map the columns and import
${imagePublicUrl ? '4. The product image URL is already included in the CSV - it should import automatically!\n5. If the image doesn\'t appear, upload product-image.png manually to the product' : '4. Find your imported product and upload product-image.png to it'}

### For Shopify:
1. Go to Products > Import
2. Upload shopify-import.csv
3. Follow the import wizard
${imagePublicUrl ? `4. The product image URL is already included in the CSV - it should import automatically!\n5. The description is properly formatted with HTML - it should display correctly\n6. If the image doesn't appear, check the product and upload product-image.png manually\n\nImage URL: ${imagePublicUrl}` : `4. IMPORTANT: After import, go to Products and find "${productName}"
5. Click on the product to edit it
6. Upload product-image.png in the Images section
7. Save the product`}

Enjoy! 🎉
`
          zip.file('README.txt', readme)
        } else {
          const readme = `# Web Shop Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image
- webshop-description.txt - Product description

## Instructions:
1. Go to your web shop admin panel
2. Create a new product
3. Upload product-image.png
4. Copy and paste the description from webshop-description.txt
5. Add product name and price manually

Note: To get WooCommerce/Shopify CSV files, please enter Product Name and Price above and export again.

Enjoy! 🎉
`
          zip.file('README.txt', readme)
        }
      }
      
      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeTab}-export-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert(`✅ ${activeTab === 'webshop' ? 'Web Shop' : activeTab === 'instagram' ? 'Instagram' : activeTab === 'facebook' ? 'Facebook' : 'Email'} export downloaded successfully!`)
    } catch (err: any) {
      console.error('Error creating export:', err)
      alert('Failed to create export package. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleBack = () => {
    const previousView = safeLocalStorage.getItem('captions_previousView')
    const adType = safeLocalStorage.getItem('captions_adType')
    
    // Clean up
    safeLocalStorage.removeItem('captions_previousView')
    safeLocalStorage.removeItem('captions_adType')
    
    if (previousView === 'marketing' && onNavigate) {
      onNavigate('marketing')
    } else if (onBack) {
      onBack()
    }
  }

  const tabs = [
    { 
      id: 'instagram' as const, 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ), 
      label: 'Instagram', 
      charLimit: 2200 
    },
    { id: 'webshop' as const, icon: '🛍️', label: 'Web Shop', charLimit: undefined },
    { 
      id: 'facebook' as const, 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ), 
      label: 'Facebook', 
      charLimit: undefined 
    },
    { id: 'email' as const, icon: '📧', label: 'Email', charLimit: undefined }
  ]

  const activeTabData = tabs.find(t => t.id === activeTab)!

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#1a1a1a',
      backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(45, 20, 20, 0.6) 50%, rgba(20, 10, 10, 0.9) 100%)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        zIndex: 0
      }}></div>

      <style>{`
        .captions-container {
          position: relative;
          z-index: 1;
          padding: 20px;
          padding-bottom: 100px;
          margin: 0 auto;
          width: 100%;
        }
        .captions-grid {
          display: grid;
          gap: 24px;
        }
        
        /* Mobile */
        .captions-container { max-width: 500px; }
        .captions-grid { grid-template-columns: 1fr; }

        /* Desktop */
        @media (min-width: 1024px) {
          .captions-container { max-width: 1400px !important; padding: 40px !important; }
          .captions-grid { grid-template-columns: 450px 1fr !important; gap: 40px !important; }
        }
      `}</style>

      <div className="captions-container">
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px',
          paddingTop: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={handleBack}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}
            >
              ←
            </button>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Create Captions</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Generate AI-powered captions for any platform</p>
            </div>
          </div>
        </div>

        <div className="captions-grid">
          {/* LEFT SIDE: CONTROLS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Tabs */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px'
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '12px 8px',
                    background: activeTab === tab.id ? 'rgba(102, 126, 234, 0.3)' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.5)',
                    border: activeTab === tab.id ? '1px solid rgba(102, 126, 234, 0.5)' : '1px solid transparent',
                    fontSize: '11px',
                    cursor: 'pointer',
                    borderRadius: '16px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: activeTab === tab.id ? '600' : '500'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px'
                  }}>
                    {typeof tab.icon === 'string' ? (
                      <span style={{ fontSize: '18px' }}>{tab.icon}</span>
                    ) : tab.id === 'instagram' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === tab.id ? "url(#instagram-gradient)" : "rgba(255,255,255,0.5)"}>
                        <defs>
                          <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#833ab4" />
                            <stop offset="50%" stopColor="#fd1d1d" />
                            <stop offset="100%" stopColor="#fcb045" />
                          </linearGradient>
                        </defs>
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    ) : tab.id === 'facebook' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === tab.id ? "#1877f2" : "rgba(255,255,255,0.5)"}>
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    ) : (
                      tab.icon
                    )}
                  </div>
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Caption Options */}
            {(activeTab === 'instagram' || activeTab === 'facebook' || activeTab === 'email') && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '24px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
                  Customize Generation
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'instagram' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '12px' }}>
                  {/* Tone */}
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Tone
                    </label>
                    <select
                      value={activeTab === 'instagram' ? instagramOptions.tone : activeTab === 'facebook' ? facebookOptions.tone : emailOptions.tone}
                      onChange={(e) => {
                        const value = e.target.value as 'casual' | 'medium' | 'formal'
                        if (activeTab === 'instagram') {
                          setInstagramOptions({ ...instagramOptions, tone: value })
                        } else if (activeTab === 'facebook') {
                          setFacebookOptions({ ...facebookOptions, tone: value })
                        } else {
                          setEmailOptions({ ...emailOptions, tone: value })
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="casual">Casual</option>
                      <option value="medium">Balanced</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>
                  
                  {/* Length */}
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Length
                    </label>
                    <select
                      value={activeTab === 'instagram' ? instagramOptions.length : activeTab === 'facebook' ? facebookOptions.length : emailOptions.length}
                      onChange={(e) => {
                        const value = e.target.value as 'short' | 'medium' | 'long'
                        if (activeTab === 'instagram') {
                          setInstagramOptions({ ...instagramOptions, length: value })
                        } else if (activeTab === 'facebook') {
                          setFacebookOptions({ ...facebookOptions, length: value })
                        } else {
                          setEmailOptions({ ...emailOptions, length: value })
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </div>
                  
                  {/* Hashtags - Only for Instagram */}
                  {activeTab === 'instagram' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Hashtags
                      </label>
                      <div 
                        onClick={() => setInstagramOptions({ ...instagramOptions, hashtags: !instagramOptions.hashtags })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={instagramOptions.hashtags}
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', color: '#fff' }}>Include</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Email Subject - Only for Email tab */}
            {activeTab === 'email' && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '24px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={captions.emailSubject}
                  onChange={(e) => setCaptions({ ...captions, emailSubject: e.target.value })}
                  placeholder="Subject line will be generated..."
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            )}

            {/* Product Info - Only for Web Shop tab */}
            {activeTab === 'webshop' && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '24px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
                  Product Information
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g., Fashion T-Shirt"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Price
                    </label>
                    <input
                      type="text"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder="99.99"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#fff',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Caption Textarea */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>{activeTabData.label} Content</h3>
                <button
                  onClick={() => generateSpecificCaption(activeTab)}
                  disabled={loading[activeTab] || !currentImage}
                  style={{
                    padding: '10px 20px',
                    background: loading[activeTab] || !currentImage ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: loading[activeTab] || !currentImage ? 'rgba(255,255,255,0.4)' : '#fff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: loading[activeTab] || !currentImage ? 'not-allowed' : 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: loading[activeTab] || !currentImage ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  {loading[activeTab] ? (
                    <>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Generating...
                    </>
                  ) : (
                    <>✨ Generate</>
                  )}
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={captions[activeTab]}
                onChange={(e) => setCaptions({ ...captions, [activeTab]: e.target.value })}
                onSelect={(e) => {
                  const textarea = e.target as HTMLTextAreaElement
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const selected = textarea.value.substring(start, end)
                  
                  if (selected.trim().length > 0) {
                    setSelectedText(selected)
                    setSelectionStart(start)
                    setSelectionEnd(end)
                  } else {
                    setSelectedText('')
                  }
                }}
                placeholder={`Click "Generate" to create ${activeTabData.label.toLowerCase()} content...`}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '16px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  fontSize: '14px',
                  lineHeight: '1.7',
                  resize: 'vertical',
                  outline: 'none',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontFamily: 'inherit'
                }}
              />
              
              {/* Character count and Copy button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  {captions[activeTab].length.toLocaleString()} characters
                  {activeTabData.charLimit && ` / ${activeTabData.charLimit.toLocaleString()} limit`}
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {captions[activeTab] && (
                    <button
                      onClick={() => copyCaption(activeTab)}
                      style={{
                        padding: '8px 16px',
                        background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)',
                        border: copied ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(255,255,255,0.2)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        borderRadius: '10px',
                        color: copied ? '#22c55e' : 'rgba(255,255,255,0.8)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {copied ? '✓ Copied' : '📋 Copy'}
                    </button>
                  )}
                  
                  {/* Export Button - Only show if caption is generated for this tab */}
                  {captions[activeTab] && currentImage && (
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      style={{
                        padding: '8px 16px',
                        background: exporting ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: exporting ? 'not-allowed' : 'pointer',
                        borderRadius: '10px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        boxShadow: exporting ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (!exporting) {
                          e.currentTarget.style.transform = 'translateY(-1px)'
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!exporting) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                        }
                      }}
                    >
                      {exporting ? (
                        <>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: '#fff',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          Exporting...
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          Export
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Ask AI to Expand */}
              {selectedText.trim().length > 0 && activeTab !== 'webshop' && (
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={async () => {
                      if (!selectedText.trim() || expandingText) return
                      
                      setExpandingText(true)
                      try {
                        const expanded = await expandTextWithAI({
                          selectedText: selectedText,
                          platform: activeTab,
                          context: currentScenePrompt || scenePrompt,
                          instagramOptions: activeTab === 'instagram' ? instagramOptions : undefined,
                          facebookOptions: activeTab === 'facebook' ? facebookOptions : undefined,
                          emailOptions: activeTab === 'email' ? emailOptions : undefined
                        })
                        
                        const currentText = captions[activeTab]
                        const beforeSelection = currentText.substring(0, selectionStart)
                        const afterSelection = currentText.substring(selectionEnd)
                        const newText = beforeSelection + selectedText + ' ' + expanded + afterSelection
                        
                        setCaptions({ ...captions, [activeTab]: newText })
                        setSelectedText('')
                      } catch (err: any) {
                        setError(err.message || 'Failed to expand text.')
                      } finally {
                        setExpandingText(false)
                      }
                    }}
                    disabled={expandingText}
                    style={{
                      padding: '8px 16px',
                      background: expandingText ? 'rgba(0, 0, 0, 0.2)' : 'rgba(102, 126, 234, 0.2)',
                      color: expandingText ? 'rgba(255,255,255,0.4)' : '#667eea',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: expandingText ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {expandingText ? 'Expanding...' : '✨ Ask AI to Expand'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div style={{ 
                padding: '14px 18px', 
                background: 'rgba(220, 38, 38, 0.2)', 
                border: '1px solid rgba(220, 38, 38, 0.3)', 
                borderRadius: '16px', 
                color: 'rgba(255, 255, 255, 0.9)', 
                fontSize: '13px',
                backdropFilter: 'blur(10px)'
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* RIGHT SIDE: PREVIEW */}
          <div style={{ 
            background: 'rgba(0, 0, 0, 0.4)', 
            borderRadius: '24px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '350px',
            maxHeight: 'calc(100vh - 150px)',
            position: 'relative', 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            padding: '20px'
          }}>
            {currentImage ? (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                {/* Platform-specific Preview */}
                {activeTab === 'instagram' && (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '350px',
                    width: '100%',
                    maxHeight: 'calc(100vh - 200px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    {/* Instagram Header */}
                    <div style={{
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      flexShrink: 0
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(45deg, #f09433 0%, #dc2743 50%, #bc1888 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '14px'
                      }}>A</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>your_brand</div>
                      </div>
                      <div style={{ fontSize: '18px', opacity: 0.6 }}>⋯</div>
                    </div>

                    {/* Image */}
                    <div style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '16px',
                      minHeight: '400px',
                      flexShrink: 0
                    }}>
                      <img 
                        src={currentImage} 
                        alt="Preview" 
                        style={{ 
                          maxWidth: '100%',
                          maxHeight: '500px',
                          height: 'auto',
                          width: 'auto',
                          objectFit: 'contain',
                          display: 'block'
                        }} 
                      />
                    </div>

                    {/* Actions */}
                    <div style={{ 
                      padding: '12px 14px',
                      flexShrink: 0,
                      borderTop: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', opacity: 0.8 }}>
                        <span>❤️</span>
                        <span>💬</span>
                        <span>📤</span>
                        <span style={{ marginLeft: 'auto' }}>🔖</span>
                      </div>
                      
                      {captions.instagram ? (
                        <div style={{ 
                          fontSize: '13px', 
                          lineHeight: '1.5', 
                          color: 'rgba(255,255,255,0.9)',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          wordBreak: 'break-word',
                          paddingRight: '4px'
                        }}>
                          <span style={{ fontWeight: '600', marginRight: '6px' }}>your_brand</span>
                          {captions.instagram}
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                          Caption will appear here...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'facebook' && (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '400px',
                    width: '100%',
                    maxHeight: 'calc(100vh - 200px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    {/* Facebook Header */}
                    <div style={{
                      padding: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexShrink: 0
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#1877f2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '16px'
                      }}>YB</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>Your Brand</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Just now · 🌍</div>
                      </div>
                    </div>

                    {/* Caption */}
                    {captions.facebook ? (
                      <div style={{ 
                        padding: '0 14px 14px', 
                        fontSize: '14px', 
                        lineHeight: '1.5', 
                        color: 'rgba(255,255,255,0.9)',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        wordBreak: 'break-word',
                        paddingRight: '8px',
                        flexShrink: 0
                      }}>
                        {captions.facebook}
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '0 14px 14px', 
                        fontSize: '14px', 
                        color: 'rgba(255,255,255,0.4)', 
                        fontStyle: 'italic',
                        flexShrink: 0
                      }}>
                        Caption will appear here...
                      </div>
                    )}

                    {/* Image */}
                    <div style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '16px',
                      minHeight: '400px',
                      flexShrink: 0
                    }}>
                      <img 
                        src={currentImage} 
                        alt="Preview" 
                        style={{ 
                          maxWidth: '100%',
                          maxHeight: '500px',
                          height: 'auto',
                          width: 'auto',
                          objectFit: 'contain',
                          display: 'block'
                        }} 
                      />
                    </div>

                    {/* Actions */}
                    <div style={{ 
                      padding: '10px 14px',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      justifyContent: 'space-around',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.6)',
                      flexShrink: 0
                    }}>
                      <span>👍 Like</span>
                      <span>💬 Comment</span>
                      <span>📤 Share</span>
                    </div>
                  </div>
                )}

                {activeTab === 'webshop' && (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '400px',
                    width: '100%',
                    maxHeight: 'calc(100vh - 200px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    {/* Product Image */}
                    {currentImage && (
                      <div style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '24px',
                        minHeight: '400px',
                        flexShrink: 0
                      }}>
                        <img 
                          src={currentImage} 
                          alt="Product" 
                          style={{ 
                            maxWidth: '100%',
                            maxHeight: '500px',
                            height: 'auto',
                            width: 'auto',
                            objectFit: 'contain',
                            display: 'block',
                            borderRadius: '8px'
                          }} 
                        />
                      </div>
                    )}

                    {/* Product Info - Scrollable */}
                    <div style={{ 
                      padding: '24px',
                      overflowY: 'auto',
                      flex: 1,
                      minHeight: 0
                    }}>
                      {/* Product Name */}
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: '700', 
                        color: '#fff', 
                        marginBottom: '12px',
                        minHeight: '32px',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        {productName ? (
                          <span>{productName}</span>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontWeight: '400' }}>
                            Enter product name...
                          </span>
                        )}
                      </div>
                      
                      {/* Product Price */}
                      <div style={{ 
                        fontSize: '22px', 
                        fontWeight: '700', 
                        color: '#fff', 
                        marginBottom: '20px',
                        minHeight: '30px',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        {productPrice ? (
                          <span>${parseFloat(productPrice.replace(/[^0-9.]/g, '') || '0').toFixed(2)}</span>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontWeight: '400', fontSize: '18px' }}>
                            Enter price...
                          </span>
                        )}
                      </div>

                      {/* Product Description */}
                      {captions.webshop ? (
                        <div style={{ 
                          fontSize: '14px', 
                          lineHeight: '1.7', 
                          color: 'rgba(255,255,255,0.9)',
                          whiteSpace: 'pre-wrap',
                          marginBottom: '24px',
                          wordBreak: 'break-word'
                        }}>
                          {captions.webshop}
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: '14px', 
                          color: 'rgba(255,255,255,0.4)', 
                          fontStyle: 'italic',
                          marginBottom: '24px'
                        }}>
                          Product description will appear here...
                        </div>
                      )}

                    </div>

                    {/* Add to Cart Button - Fixed at bottom */}
                    <div style={{
                      padding: '24px',
                      paddingTop: '0',
                      flexShrink: 0,
                      borderTop: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <button style={{
                        width: '100%',
                        padding: '16px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'email' && (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '600px',
                    width: '100%',
                    maxHeight: 'calc(100vh - 150px)',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                  }}>
                    {/* Email Header */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '16px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '16px'
                      }}>
                        YB
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Your Brand</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>hello@yourbrand.com</div>
                      </div>
                    </div>

                    {/* Email Content */}
                    <div style={{ padding: '24px' }}>
                      {/* Email Fields */}
                      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            From
                          </div>
                          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>Your Brand &lt;hello@yourbrand.com&gt;</div>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            To
                          </div>
                          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>customer@example.com</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Subject
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', wordBreak: 'break-word' }}>
                            {captions.emailSubject || 'Email subject will appear here...'}
                          </div>
                        </div>
                      </div>

                      {/* Email Image */}
                      {currentImage && (
                        <div style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '16px',
                          borderRadius: '8px',
                          marginBottom: '20px',
                          minHeight: '400px'
                        }}>
                          <img 
                            src={currentImage} 
                            alt="Email Content" 
                            style={{ 
                              maxWidth: '100%',
                              maxHeight: '500px',
                              height: 'auto',
                              width: 'auto',
                              objectFit: 'contain',
                              display: 'block'
                            }} 
                          />
                        </div>
                      )}

                      {/* Email Body */}
                      {captions.email ? (
                        <div style={{ 
                          fontSize: '14px', 
                          lineHeight: '1.7', 
                          color: 'rgba(255,255,255,0.9)',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {captions.email}
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: '14px', 
                          color: 'rgba(255,255,255,0.4)', 
                          fontStyle: 'italic',
                          padding: '40px 0',
                          textAlign: 'center'
                        }}>
                          Email content will appear here...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.3 }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>💬</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: 'white' }}>No image available</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>Generate an image first</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default CreateCaptionsNovo
