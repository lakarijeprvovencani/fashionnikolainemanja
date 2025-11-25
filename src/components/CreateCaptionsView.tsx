import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { generateSocialMediaCaptions } from '../lib/gemini'
import { storage } from '../lib/supabase'
import UserMenu from './UserMenu'
import JSZip from 'jszip'

interface CreateCaptionsViewProps {
  imageUrl: string | null
  scenePrompt?: string
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const CreateCaptionsView: React.FC<CreateCaptionsViewProps> = ({ imageUrl, scenePrompt, onBack, onNavigate }) => {
  const { user } = useAuth()
  const [captions, setCaptions] = useState({
    instagram: '',
    webshop: '',
    facebook: ''
  })
  const [loading, setLoading] = useState({
    instagram: false,
    webshop: false,
    facebook: false
  })
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'instagram' | 'webshop' | 'facebook'>('instagram')
  const [productPrice, setProductPrice] = useState<string>('')
  const [productName, setProductName] = useState<string>('')
  const [exporting, setExporting] = useState(false)
  const [currentImage, setCurrentImage] = useState<string | null>(() => {
    // Load from localStorage first, then fallback to prop
    const saved = localStorage.getItem('dressModel_generatedImage')
    return saved || imageUrl
  })
  const [currentScenePrompt, setCurrentScenePrompt] = useState<string>(() => {
    // Load from localStorage first, then fallback to prop
    const saved = localStorage.getItem('dressModel_scenePrompt')
    return saved || scenePrompt || ''
  })

  // Update currentImage if localStorage has newer data
  useEffect(() => {
    const saved = localStorage.getItem('dressModel_generatedImage')
    if (saved) {
      setCurrentImage(saved)
    } else if (imageUrl) {
      setCurrentImage(imageUrl)
    }
    const savedPrompt = localStorage.getItem('dressModel_scenePrompt')
    if (savedPrompt) {
      setCurrentScenePrompt(savedPrompt)
    } else if (scenePrompt) {
      setCurrentScenePrompt(scenePrompt)
    }
  }, [imageUrl, scenePrompt])

  const generateSpecificCaption = async (platform: 'instagram' | 'webshop' | 'facebook') => {
    const imageToUse = currentImage || imageUrl
    if (!imageToUse) return

    setLoading({ ...loading, [platform]: true })
    setError('')

    try {
      const generated = await generateSocialMediaCaptions({
        imageUrl: imageToUse,
        sceneDescription: currentScenePrompt || scenePrompt
      })
      
      setCaptions({ ...captions, [platform]: generated[platform] })
    } catch (err: any) {
      setError(err.message || 'Failed to generate caption.')
    } finally {
      setLoading({ ...loading, [platform]: false })
    }
  }

  const copyCaption = (platform: 'instagram' | 'webshop' | 'facebook') => {
    if (captions[platform]) {
      navigator.clipboard.writeText(captions[platform])
      // Could add a toast notification here
    }
  }

  const tabs = [
    { id: 'instagram' as const, icon: '📷', label: 'Instagram', placeholder: 'Click "Generate" to create an engaging Instagram caption with hashtags and emojis...', charLimit: 2200 },
    { id: 'webshop' as const, icon: '🛍️', label: 'Web Shop', placeholder: 'Click "Generate" to create a professional product description...', charLimit: undefined },
    { id: 'facebook' as const, icon: '📘', label: 'Facebook', placeholder: 'Click "Generate" to create a conversational Facebook post...', charLimit: undefined }
  ]

  const activeTabData = tabs.find(t => t.id === activeTab)!

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <header className="dashboard-header" style={{ background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '20px 40px', height: '80px' }}>
        <div className="dashboard-header-content" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title" style={{ color: '#000', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0 }}>
              Create Captions
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={onBack} style={{ background: 'transparent', color: '#000', border: '1px solid #e0e0e0', padding: '8px 16px', borderRadius: '0px', fontSize: '13px', cursor: 'pointer' }}>
              ← Back
            </button>
            {onNavigate && <UserMenu onNavigate={onNavigate} />}
          </div>
        </div>
      </header>

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '450px 1fr', gap: '60px' }}>
          
          {/* LEFT: Captions Controls */}
          <div>
            {/* Tabs */}
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '32px',
              borderBottom: '1px solid #f0f0f0',
              paddingBottom: '16px'
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: activeTab === tab.id ? '#000' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : '#666',
                    border: activeTab === tab.id ? 'none' : '1px solid #e0e0e0',
                    fontSize: '20px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.background = '#f9f9f9'
                      e.currentTarget.style.borderColor = '#000'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#e0e0e0'
                    }
                  }}
                >
                  {tab.icon}
                </button>
              ))}
            </div>

            {/* Active Tab Content */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#000', margin: 0 }}>
                  {activeTabData.label}
                </h3>
                <button
                  onClick={() => generateSpecificCaption(activeTab)}
                  disabled={loading[activeTab]}
                  style={{
                    padding: '10px 20px',
                    background: loading[activeTab] ? '#e0e0e0' : '#000',
                    color: loading[activeTab] ? '#999' : '#fff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: loading[activeTab] ? 'not-allowed' : 'pointer',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading[activeTab]) {
                      e.currentTarget.style.background = '#333'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading[activeTab]) {
                      e.currentTarget.style.background = '#000'
                    }
                  }}
                >
                  {loading[activeTab] ? '...' : '✨ Generate'}
                </button>
              </div>

              {/* Product Info Fields - Only for Web Shop */}
              {activeTab === 'webshop' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g., Fashion T-Shirt"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Price ($)
                    </label>
                    <input
                      type="number"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder="99.99"
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                    />
                  </div>
                </div>
              )}

              <textarea
                value={captions[activeTab]}
                onChange={(e) => setCaptions({ ...captions, [activeTab]: e.target.value })}
                placeholder={activeTabData.placeholder}
                style={{
                  width: '100%',
                  minHeight: '300px',
                  padding: '18px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                  background: '#fafafa'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>
                  {captions[activeTab].length} characters
                  {activeTabData.charLimit && ` (limit: ${activeTabData.charLimit.toLocaleString()})`}
                </p>
                {captions[activeTab] && (
                  <button
                    onClick={() => copyCaption(activeTab)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: '1px solid #e0e0e0',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      color: '#666',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#000'
                      e.currentTarget.style.color = '#000'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e0e0e0'
                      e.currentTarget.style.color = '#666'
                    }}
                  >
                    📋 Copy
                  </button>
                )}
              </div>

              {/* Export Button - Only show if caption is generated for this tab */}
              {captions[activeTab] && currentImage && (
                <button
                  onClick={async () => {
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
                      
                      alert(`✅ ${activeTabData.label} export downloaded successfully!`)
                    } catch (err: any) {
                      console.error('Error creating export:', err)
                      alert('Failed to create export package. Please try again.')
                    } finally {
                      setExporting(false)
                    }
                  }}
                  disabled={exporting}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '12px',
                    background: exporting ? '#e0e0e0' : '#000',
                    color: exporting ? '#999' : '#fff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!exporting) {
                      e.currentTarget.style.background = '#333'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!exporting) {
                      e.currentTarget.style.background = '#000'
                    }
                  }}
                >
                  {exporting ? '⏳ Creating Package...' : `📦 Export ${activeTabData.label} (ZIP)`}
                </button>
              )}
            </div>

            {error && (
              <div style={{ padding: '12px', background: '#fff5f5', color: '#c53030', fontSize: '13px', border: '1px solid #feb2b2', borderRadius: '6px', marginTop: '24px' }}>
                {error}
              </div>
            )}

            {/* Copy All Button - Only show if at least one caption exists */}
            {(captions.instagram || captions.webshop || captions.facebook) && (
              <button
                onClick={() => {
                  const allCaptions = `INSTAGRAM:\n${captions.instagram}\n\nWEB SHOP:\n${captions.webshop}\n\nFACEBOOK:\n${captions.facebook}`
                  navigator.clipboard.writeText(allCaptions)
                  alert('All captions copied to clipboard!')
                }}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px',
                  background: '#f9f9f9',
                  color: '#000',
                  border: '1px solid #e0e0e0',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.borderColor = '#000'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f9f9f9'
                  e.currentTarget.style.borderColor = '#e0e0e0'
                }}
              >
                📋 Copy All Captions
              </button>
            )}
          </div>

          {/* RIGHT: Platform Preview */}
          <div style={{ 
            position: 'sticky',
            top: '100px',
            height: 'fit-content'
          }}>
            {activeTab === 'instagram' && (
              <div style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #dbdbdb',
                maxWidth: '400px',
                margin: '0 auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                {/* Instagram Header */}
                <div style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid #efefef'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    A
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#262626' }}>your_brand</div>
                  </div>
                  <div style={{ fontSize: '20px', color: '#262626', cursor: 'pointer' }}>⋯</div>
                </div>

                {/* Instagram Image */}
                {currentImage && (
                  <div style={{ width: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src={currentImage} 
                      alt="Post" 
                      style={{ 
                        maxWidth: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block'
                      }} 
                    />
                  </div>
                )}

                {/* Instagram Actions */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '24px', cursor: 'pointer' }}>🤍</span>
                    <span style={{ fontSize: '24px', cursor: 'pointer' }}>💬</span>
                    <span style={{ fontSize: '24px', cursor: 'pointer' }}>📤</span>
                    <span style={{ fontSize: '24px', cursor: 'pointer', marginLeft: 'auto' }}>🔖</span>
                  </div>
                  
                  {/* Caption */}
                  {captions.instagram ? (
                    <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#262626', whiteSpace: 'pre-wrap' }}>
                      <span style={{ fontWeight: '600', marginRight: '4px' }}>your_brand</span>
                      {captions.instagram}
                    </div>
                  ) : (
                    <div style={{ fontSize: '14px', color: '#8e8e8e', fontStyle: 'italic' }}>
                      Your caption will appear here...
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'facebook' && (
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #dadde1',
                maxWidth: '500px',
                margin: '0 auto',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                {/* Facebook Header */}
                <div style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
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
                    fontWeight: '600',
                    fontSize: '16px'
                  }}>
                    YB
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#050505' }}>Your Brand</div>
                    <div style={{ fontSize: '13px', color: '#65676b' }}>Just now · 🌍</div>
                  </div>
                </div>

                {/* Facebook Caption */}
                {captions.facebook ? (
                  <div style={{ 
                    padding: '12px 16px', 
                    fontSize: '15px', 
                    lineHeight: '1.5', 
                    color: '#050505',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {captions.facebook}
                  </div>
                ) : (
                  <div style={{ 
                    padding: '12px 16px', 
                    fontSize: '15px', 
                    color: '#8e8e8e', 
                    fontStyle: 'italic' 
                  }}>
                    Your Facebook post will appear here...
                  </div>
                )}

                {/* Facebook Image */}
                {currentImage && (
                  <div style={{ width: '100%', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src={currentImage} 
                      alt="Post" 
                      style={{ 
                        maxWidth: '100%',
                        maxHeight: '600px',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block'
                      }} 
                    />
                  </div>
                )}

                {/* Facebook Actions */}
                <div style={{ 
                  padding: '8px 16px',
                  borderTop: '1px solid #dadde1',
                  display: 'flex',
                  justifyContent: 'space-around',
                  color: '#65676b',
                  fontSize: '15px',
                  fontWeight: '600'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px' }}>
                    <span>👍</span> Like
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px' }}>
                    <span>💬</span> Comment
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px' }}>
                    <span>📤</span> Share
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'webshop' && (
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                maxWidth: '400px',
                margin: '0 auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                {/* Product Image */}
                {currentImage && (
                  <div style={{ width: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <img 
                      src={currentImage} 
                      alt="Product" 
                      style={{ 
                        maxWidth: '100%',
                        maxHeight: '500px',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block'
                      }} 
                    />
                  </div>
                )}

                {/* Product Info */}
                <div style={{ padding: '20px' }}>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: '600', 
                    color: '#000', 
                    marginBottom: '12px' 
                  }}>
                    Fashion Item
                  </div>
                  
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    color: '#000', 
                    marginBottom: '16px' 
                  }}>
                    $99.99
                  </div>

                  {/* Product Description */}
                  {captions.webshop ? (
                    <div style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.6', 
                      color: '#333',
                      whiteSpace: 'pre-wrap',
                      marginBottom: '20px'
                    }}>
                      {captions.webshop}
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#999', 
                      fontStyle: 'italic',
                      marginBottom: '20px'
                    }}>
                      Product description will appear here...
                    </div>
                  )}

                  {/* Add to Cart Button */}
                  <button style={{
                    width: '100%',
                    padding: '14px',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Add to Cart
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

export default CreateCaptionsView

