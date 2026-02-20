import { supabase } from '../lib/supabaseClient';

export const deleteProjectResources = async (projectId, coverUrl) => {
    try {
        const operations = [];

        // 1. Delete Cover from project-assets if it exists
        if (coverUrl) {
            // Extract path from URL. 
            // URL format: https://[project].supabase.co/storage/v1/object/public/project-assets/[userId]/[timestamp].[ext]
            // We need: [userId]/[timestamp].[ext]
            const urlParts = coverUrl.split('/project-assets/');
            if (urlParts.length > 1) {
                const path = urlParts[1];
                operations.push(
                    supabase.storage
                        .from('project-assets')
                        .remove([path])
                        .then(({ error }) => {
                            if (error) console.error('Error deleting cover:', error);
                        })
                );
            }
        }

        // 2. Delete Concept References folder
        // List files in the folder first
        const { data: files, error: listError } = await supabase.storage
            .from('concept-references')
            .list(projectId);

        if (!listError && files && files.length > 0) {
            const paths = files.map(f => `${projectId}/${f.name}`);
            operations.push(
                supabase.storage
                    .from('concept-references')
                    .remove(paths)
                    .then(({ error }) => {
                        if (error) console.error('Error deleting references:', error);
                    })
            );
        }

        await Promise.all(operations);
    } catch (error) {
        console.error('Error in deleteProjectResources:', error);
    }
};
