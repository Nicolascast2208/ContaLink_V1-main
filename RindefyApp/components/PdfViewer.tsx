import React from 'react';
import { View, StyleSheet } from 'react-native';
import Pdf from 'react-native-pdf';

interface PdfViewerProps {
    uri: string;
    style?: any;
}

export default function PdfViewer({ uri, style }: PdfViewerProps) {
    return (
        <Pdf
            source={{ uri }}
            style={[styles.container, style]}
            fitPolicy={0}
            trustAllCerts={false}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    }
});
