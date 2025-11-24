# Gallery System Setup Instructions

## 🎯 Overview
The gallery system allows users to save their dressed models and view them later.

## 📦 Database Structure
The system uses the existing `dressed_models` table in Supabase:

```sql
CREATE TABLE dressed_models (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    model_id UUID REFERENCES fashion_models(id) ON DELETE CASCADE NOT NULL,
    outfit_description TEXT NOT NULL,
    outfit_image_url TEXT,
    outfit_data JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🗄️ Storage Setup

### Step 1: Create Storage Bucket
Run the SQL in `storage_setup.sql` in your Supabase SQL Editor to:
- Create the `dressed-models` storage bucket
- Set up Row Level Security (RLS) policies
- Enable public read access

### Step 2: Verify Setup
1. Go to Supabase Dashboard → Storage
2. Check that `dressed-models` bucket exists
3. Verify it's set to "Public"

## ✨ Features Implemented

### 1. Save to Gallery
- **Location**: Dress Model page
- **Button**: "💾 Save to Gallery"
- **Function**: Saves generated dressed model to Supabase
- **Process**:
  1. Converts base64 image to Blob
  2. Uploads to Supabase Storage (`dressed-models` bucket)
  3. Saves record to `dressed_models` table
  4. Shows success message

### 2. Gallery View
- **Access**: Dashboard → "View Gallery" card
- **Features**:
  - Grid view of all saved dressed models
  - Shows model name, date created, scene description
  - Download button for each image
  - Delete button for each image
  - Full-screen image preview on click
  - Empty state when no images saved

### 3. Dashboard Integration
- New "My Gallery" card on dashboard
- Shows count of saved models
- Updated stats to show gallery items
- Pink gradient design to stand out

## 🔧 Technical Details

### New Helper Functions (supabase.ts)
```typescript
storage.uploadImage(bucket, path, file)
storage.deleteImage(bucket, path)
dressedModels.saveDressedModel(data)
dressedModels.getUserDressedModels(userId)
dressedModels.deleteDressedModel(id)
dressedModels.getDressedModelsCount(userId)
```

### New Components
- `Gallery.tsx` - Full gallery view component

### Modified Components
- `DressModel.tsx` - Added save functionality
- `Dashboard.tsx` - Added gallery navigation and stats

## 🚀 How to Use

### For Users:
1. Create a model (if not already done)
2. Go to "Dress Model"
3. Upload clothing images and describe the scene
4. Click "Generate Image"
5. Once generated, click "💾 Save to Gallery"
6. View all saved models in "My Gallery"

### For Developers:
1. Run `storage_setup.sql` in Supabase SQL Editor
2. Verify storage bucket is created
3. Test the flow:
   - Generate a dressed model
   - Save to gallery
   - View in gallery
   - Delete from gallery

## 📝 Notes

- Images are stored in Supabase Storage
- Database records are in `dressed_models` table
- RLS policies ensure users can only access their own images
- Public read access allows sharing of gallery links
- Images are organized by user ID and model ID

## 🔒 Security

- Users can only upload/update/delete their own images
- Folder structure: `{userId}/{modelId}/dressed-{timestamp}.png`
- RLS policies enforce user-level access control
- Public can view images (useful for sharing)

## 🎨 UI/UX Features

- Visual feedback when saving (button changes to "Saved")
- Loading states during save operation
- Success messages
- Confirmation dialogs for deletions
- Responsive grid layout
- Smooth hover effects
- Full-screen image preview modal

