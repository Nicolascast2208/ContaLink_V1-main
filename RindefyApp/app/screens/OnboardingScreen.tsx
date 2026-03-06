import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Bienvenido a Rindefy',
        description: 'La forma más inteligente y rápida de rendir tus gastos corporativos y mantener el control.',
        icon: 'receipt-outline'
    },
    {
        id: '2',
        title: 'Inteligencia Artificial',
        description: 'Olvídate de digitar. Solo toma una foto a tu boleta y nuestra IA extraerá los montos y datos automáticamente.',
        icon: 'scan-outline'
    },
    {
        id: '3',
        title: 'Colaboración en Equipo',
        description: 'Administra los gastos de toda tu empresa, aprueba rendiciones y consolida la información en segundos.',
        icon: 'people-outline'
    },
    {
        id: '4',
        title: 'Exporta con un Click',
        description: 'Genera reportes Excel listos para contabilidad con todos los respaldos organizados.',
        icon: 'document-text-outline'
    }
];

interface Props {
    onFinish: () => void;
}

export default function OnboardingScreen({ onFinish }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<ScrollView>(null);

    const handleScroll = (event: any) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / width);
        setCurrentIndex(index);
    };

    const nextSlide = () => {
        if (currentIndex < SLIDES.length - 1) {
            scrollRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
        } else {
            onFinish();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.skipContainer}>
                {currentIndex < SLIDES.length - 1 && (
                    <TouchableOpacity onPress={onFinish}>
                        <Text style={styles.skipText}>Omitir</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                bounces={false}
            >
                {SLIDES.map((slide) => (
                    <View key={slide.id} style={styles.slide}>
                        <View style={styles.iconContainer}>
                            <Ionicons name={slide.icon as any} size={100} color="#007AFF" />
                        </View>
                        <Text style={styles.title}>{slide.title}</Text>
                        <Text style={styles.description}>{slide.description}</Text>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.dotsContainer}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                currentIndex === index ? styles.activeDot : null
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.button}
                    activeOpacity={0.8}
                    onPress={nextSlide}
                >
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? "Comenzar" : "Siguiente"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    skipContainer: {
        paddingHorizontal: 20,
        paddingTop: 10,
        alignItems: 'flex-end',
        height: 40,
    },
    skipText: {
        color: '#999',
        fontSize: 16,
        fontWeight: '600',
    },
    slide: {
        width,
        alignItems: 'center',
        padding: 20,
        paddingTop: height * 0.1,
    },
    iconContainer: {
        width: 200,
        height: 200,
        backgroundColor: '#F0F8FF',
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    footer: {
        padding: 30,
        paddingBottom: 50,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 30,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#E5E5EA',
        marginHorizontal: 5,
    },
    activeDot: {
        backgroundColor: '#007AFF',
        width: 20,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    }
});
