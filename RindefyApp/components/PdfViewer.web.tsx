import React from 'react';
import { View, StyleSheet } from 'react-native';

interface PdfViewerProps {
    uri: string;
    style?: any;
}

export default function PdfViewer({ uri, style }: PdfViewerProps) {
    // Rendereo de iframe nativo para la Web
    return (
        <View style={[styles.container, style]}>
            <iframe
                src={uri}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="PDF Viewer"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    }
});
