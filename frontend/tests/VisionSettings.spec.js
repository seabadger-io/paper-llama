import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VisionSettings from '../assets/components/VisionSettings.js'

const makeWrapper = (vision_fallback = 'off', extra = {}) =>
    mount(VisionSettings, {
        props: {
            modelValue: {
                vision_fallback,
                vision_pages: 3,
                ...extra
            }
        }
    })

describe('VisionSettings Component', () => {
    it('always renders the vision model warning notice', () => {
        const wrapper = makeWrapper('off')
        expect(wrapper.text()).toContain('Requires a vision-capable model')
    })

    it('renders the Vision Fallback mode select with all three options', () => {
        const wrapper = makeWrapper('off')
        const options = wrapper.findAll('select')[0].findAll('option')
        const values = options.map(o => o.element.value)
        expect(values).toEqual(['off', 'on', 'force'])
    })

    it('hides pages input when mode is off', () => {
        const wrapper = makeWrapper('off')
        // Only one select (the mode select); pages input not rendered
        expect(wrapper.find('input[type="number"]').exists()).toBe(false)
        expect(wrapper.findAll('select')).toHaveLength(1)
    })

    it('shows pages input when mode is "on"', () => {
        const wrapper = makeWrapper('on')
        expect(wrapper.find('input[type="number"]').exists()).toBe(true)
        expect(wrapper.findAll('select')).toHaveLength(1) // mode
    })

    it('shows pages input when mode is "force"', () => {
        const wrapper = makeWrapper('force')
        expect(wrapper.find('input[type="number"]').exists()).toBe(true)
        expect(wrapper.findAll('select')).toHaveLength(1)
    })

    it('shows the correct description for mode "off"', () => {
        const wrapper = makeWrapper('off')
        expect(wrapper.text()).toContain('Vision fallback is disabled')
    })

    it('shows the correct description for mode "on"', () => {
        const wrapper = makeWrapper('on')
        expect(wrapper.text()).toContain('Paperless OCR didn\'t extract any text or the AI deems the text unreadable')
    })

    it('shows the correct description for mode "force"', () => {
        const wrapper = makeWrapper('force')
        expect(wrapper.text()).toContain('ignoring the Paperless extracted content entirely')
    })
})
