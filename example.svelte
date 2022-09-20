<script lang="ts">

const handler = (e:Event) => (e.target as HTMLInputElement).classList.add("focused")

</script>


<button  on:focus={handler}>Button</button>